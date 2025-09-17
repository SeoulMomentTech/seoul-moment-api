import { CacheService } from '@app/cache/cache.service';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  initializeTransactionalContext,
  addTransactionalDataSource,
} from 'typeorm-transactional';

import { TestCacheModule } from './test-cache.module';
import { TestDatabaseModule } from './test-database.module';

export class TestSetup {
  private static dataSource: DataSource;
  private static cacheService: CacheService;
  private static cacheModule: TestingModule;
  private static fullModule: TestingModule;

  /**
   * 테스트 환경 안전성 검증
   */
  private static validateTestEnvironment(): void {
    // NODE_ENV가 test가 아니면 에러
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        `DANGER: Tests running in non-test environment! NODE_ENV=${process.env.NODE_ENV}`,
      );
    }

    // 실제 프로덕션/개발 DB를 가리키고 있으면 에러
    const dbName = process.env.DATABASE_NAME;
    if (!dbName || !dbName.includes('test')) {
      throw new Error(
        `DANGER: Test database name must contain 'test'. Current: ${dbName}`,
      );
    }

    // 테스트용 포트가 아니면 에러
    const dbPort = process.env.DATABASE_PORT;
    if (dbPort !== '5433') {
      throw new Error(
        `DANGER: Test database must use port 5433. Current: ${dbPort}`,
      );
    }

    console.log('✅ Test environment validation passed');
  }

  /**
   * 테스트 유틸리티 초기화 (Cache만 필요한 경우)
   */
  static async initializeCache(): Promise<void> {
    this.validateTestEnvironment();

    if (this.cacheService && this.cacheModule) {
      return;
    }

    this.cacheModule = await Test.createTestingModule({
      imports: [TestCacheModule],
    }).compile();

    this.cacheService = this.cacheModule.get<CacheService>(CacheService);
  }

  /**
   * 테스트 유틸리티 초기화 (DB와 Cache 접근용)
   */
  static async initialize(): Promise<void> {
    this.validateTestEnvironment();

    if (this.dataSource && this.cacheService && this.fullModule) {
      return;
    }

    // 트랜잭션 컨텍스트 초기화
    initializeTransactionalContext();

    // Cache-only 모듈이 이미 있다면 정리
    if (this.cacheModule) {
      await this.cacheModule.close();
      this.cacheModule = null;
      this.cacheService = null;
    }

    this.fullModule = await Test.createTestingModule({
      imports: [TestDatabaseModule],
    }).compile();

    this.dataSource = this.fullModule.get<DataSource>(DataSource);
    this.cacheService = this.fullModule.get<CacheService>(CacheService);

    // 트랜잭션 데이터 소스 등록
    addTransactionalDataSource(this.dataSource);
  }

  /**
   * 테스트 완료 후 정리
   */
  static async cleanup(): Promise<void> {
    if (this.cacheService) {
      try {
        await this.clearCache();
      } catch (error) {
        // Suppress Redis connection warnings for cache-only tests
        if (error.message !== 'Connection is closed.') {
          console.warn(
            'Warning: Failed to clear cache during cleanup:',
            error.message,
          );
        }
      }
    }

    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }

    if (this.cacheModule) {
      await this.cacheModule.close();
      this.cacheModule = null;
    }

    if (this.fullModule) {
      await this.fullModule.close();
      this.fullModule = null;
    }

    this.dataSource = null;
    this.cacheService = null;
  }

  /**
   * 각 테스트 전 데이터베이스 및 캐시 초기화
   */
  static async clearDatabase(): Promise<void> {
    // Clear Redis cache first
    await this.clearCache();

    // Skip DB operations if no DataSource (cache-only tests)
    if (!this.dataSource) {
      return;
    }

    try {
      // 자식 테이블부터 순서대로 정리 (외래키 참조 순서 고려)
      const tables = [
        'article_section_image',
        'news_section_image',
        'home_section_image',
        'brand_section_image',
        'brand_banner_image',
        'home_banner_image',
        'product_color_image',
        'variant_option',
        'multilingual_text',
        'article_section',
        'news_section',
        'home_section',
        'brand_section',
        'product_image',
        'product_variant',
        'product_color',
        'option_value',
        'partner',
        'partner_category',
        'product',
        'product_category',
        'option',
        'article',
        'news',
        'brand',
        'category',
        'language',
      ];

      for (const tableName of tables) {
        try {
          // 테이블 존재 확인
          const exists = await this.dataSource.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = '${tableName}'
            );
          `);

          if (exists[0].exists) {
            // CASCADE 옵션으로 참조된 데이터도 함께 삭제
            await this.dataSource.query(
              `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`,
            );
          }
        } catch (error) {
          // 여전히 실패하면 DELETE 사용 (느리지만 확실함)
          if (!error.message.includes('does not exist')) {
            try {
              await this.dataSource.query(`DELETE FROM "${tableName}"`);
              // 시퀀스 초기화
              await this.dataSource.query(
                `ALTER SEQUENCE IF EXISTS "${tableName}_id_seq" RESTART WITH 1`,
              );
            } catch (deleteError) {
              // Suppress DB connection warnings for cache-only tests
              if (!deleteError.message.includes('Driver not Connected')) {
                console.warn(
                  `Warning: Failed to clear table ${tableName}:`,
                  deleteError.message,
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Database cleanup failed:', error.message);
    }
  }

  /**
   * 데이터베이스 연결 상태 확인
   */
  static async checkConnection(): Promise<boolean> {
    if (!this.dataSource) {
      return false;
    }

    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  /**
   * 테스트용 데이터 시드
   */
  static async seedTestData(): Promise<void> {
    // 필요시 기본 테스트 데이터를 여기서 생성
    // 예: 기본 브랜드, 관리자 등
  }

  /**
   * 현재 데이터소스 인스턴스 반환
   */
  static getDataSource(): DataSource {
    if (!this.dataSource) {
      throw new Error('DataSource not initialized. Call initialize() first.');
    }
    return this.dataSource;
  }

  /**
   * Redis 캐시 정리
   */
  static async clearCache(): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    try {
      // Get all keys and delete them
      const keys = await this.cacheService.scan('*');
      for (const key of keys) {
        await this.cacheService.del(key);
      }
    } catch (error) {
      // Suppress Redis connection warnings for cache-only tests
      if (error.message !== 'Connection is closed.') {
        console.warn('Warning: Failed to clear cache:', error.message);
      }
    }
  }

  /**
   * CacheService 인스턴스 반환
   */
  static getCacheService(): CacheService {
    if (!this.cacheService) {
      throw new Error('CacheService not initialized. Call initialize() first.');
    }
    return this.cacheService;
  }
}

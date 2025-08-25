import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TestDatabaseModule } from './test-database.module';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';

export class TestSetup {
  private static dataSource: DataSource;
  private static module: TestingModule;

  /**
   * 테스트 모듈과 데이터베이스 연결 초기화
   */
  static async initialize(): Promise<TestingModule> {
    if (this.module) {
      return this.module;
    }

    this.module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [BrandRepositoryService],
    }).compile();

    this.dataSource = this.module.get<DataSource>(DataSource);

    return this.module;
  }

  /**
   * 테스트 완료 후 정리
   */
  static async cleanup(): Promise<void> {
    if (this.dataSource) {
      await this.dataSource.destroy();
    }
    if (this.module) {
      await this.module.close();
    }
    this.dataSource = null;
    this.module = null;
  }

  /**
   * 각 테스트 전 데이터베이스 초기화
   */
  static async clearDatabase(): Promise<void> {
    if (!this.dataSource) {
      throw new Error('DataSource not initialized. Call initialize() first.');
    }

    try {
      // 외래키 제약조건이 없으므로 간단하게 각 테이블 정리 (실제 테이블 이름 사용)
      const tables = ['brand', 'brand_banner_image', 'brand_section', 'brand_section_image'];
      
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
            await this.dataSource.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY`);
          }
        } catch (error) {
          // 테이블이 없는 경우는 정상적인 상황이므로 로깅만 수행
          if (!error.message.includes('does not exist')) {
            console.error(`Failed to clear table ${tableName}:`, error.message);
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
   * 현재 모듈 인스턴스 반환
   */
  static getModule(): TestingModule {
    if (!this.module) {
      throw new Error('Test module not initialized. Call initialize() first.');
    }
    return this.module;
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
}
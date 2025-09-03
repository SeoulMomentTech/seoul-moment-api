# Claude Code 개발 가이드

## 통합 테스트 환경 설정 가이드

### 1. 테스트 환경 구성 원칙

#### PostgreSQL Docker 컨테이너 사용

- **실제 데이터베이스** 사용 (인메모리나 모킹 대신)
- `docker-compose.test.yml`로 테스트 전용 PostgreSQL 컨테이너 구성
- 테스트 격리를 위한 독립적인 데이터베이스 환경

#### 테스트 명령어

```bash
# 전체 통합 테스트 실행 (권장)
npm run test:full

# 단계별 실행
npm run test:db:up        # PostgreSQL 컨테이너 시작
npm run test:integration  # 통합 테스트 실행 (--runInBand 포함)
npm run test:db:down      # 컨테이너 정리

# 개발 중 유용한 명령어
npm run test:integration:watch  # watch 모드
npm run test:db:logs           # DB 로그 확인
```

**중요**: `test:integration` 명령어는 `--runInBand` 옵션을 포함하여 deadlock 방지

### 2. TypeORM 엔티티 설정 원칙

#### 테스트 환경에서 외래키 제약조건 비활성화

```typescript
@ManyToOne(() => ParentEntity, (parent) => parent.children, {
  onDelete: 'CASCADE',
  createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
})
@JoinColumn({ name: 'parent_id' })
parent: ParentEntity;
```

**이유**: 테스트 환경에서 외래키 제약조건이 있으면 `TRUNCATE CASCADE`가 복잡해지고, 데이터 정리 시 순서 의존성 문제가 발생

#### 실제 테이블 이름 확인 필수

TypeORM naming strategy에 의해 엔티티 이름과 실제 테이블 이름이 다를 수 있음:

- `BrandEntity` → `brand` 테이블
- `BrandBannerImageEntity` → `brand_banner_image` 테이블
- `BrandSectionEntity` → `brand_section` 테이블 (brand_info_sections가 아님)

### 3. 테스트 데이터베이스 정리 전략

#### TestSetup 클래스의 clearDatabase() 메서드

```typescript
static async clearDatabase(): Promise<void> {
  try {
    // 자식 테이블부터 순서대로 정리 (외래키 참조 순서 고려)
    const tables = ['brand_section_image', 'brand_banner_image', 'brand_section', 'brand'];

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
          await this.dataSource.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
        }
      } catch (error) {
        // 여전히 실패하면 DELETE 사용 (느리지만 확실함)
        if (!error.message.includes('does not exist')) {
          try {
            await this.dataSource.query(`DELETE FROM "${tableName}"`);
            // 시퀀스 초기화
            await this.dataSource.query(`ALTER SEQUENCE IF EXISTS "${tableName}_id_seq" RESTART WITH 1`);
          } catch (deleteError) {
            console.warn(`Warning: Failed to clear table ${tableName}:`, deleteError.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Database cleanup failed:', error.message);
  }
}
```

#### Jest 설정에서 정리 타이밍

```typescript
// beforeAll: 초기 정리
beforeAll(async () => {
  await TestSetup.initialize();
  await TestSetup.clearDatabase(); // 초기화 완료 후 정리
});

// beforeEach: 각 테스트 전 정리 (테스트 격리 보장)
beforeEach(async () => {
  await TestSetup.clearDatabase();
});
```

**주의**:

- `beforeEach`에서 데이터 정리하면 테스트 중간 단계에서 데이터가 사라질 수 있음
- `afterEach`에서 데이터 정리하여 테스트 격리 보장 (현재 권장 방식)
- deadlock 방지를 위해 `--runInBand` 옵션과 함께 사용

### 4. 테스트 작성 시 주의사항

#### ServiceError 테스트

```typescript
// ❌ 잘못된 방법
expect(error.errorCode).toBe(ServiceErrorCode.NOT_FOUND_DATA);

// ✅ 올바른 방법
expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
```

#### Eager Loading 정렬 문제

TypeORM의 eager loading은 정렬을 보장하지 않음:

```typescript
// 테스트에서 수동 정렬 후 검증
const sortedBanners = brand.brandBannerImageList.sort(
  (a, b) => a.sortOrder - b.sortOrder,
);
expect(sortedBanners[0].sortOrder).toBe(1);
```

#### 테스트 데이터 팩토리 활용

```typescript
// 복잡한 관계 데이터 생성
const brand = await testDataFactory.createFullBrand({
  brand: { name: 'Test Brand', status: BrandStatus.NORMAL },
  banners: [
    { sortOrder: 1, imageUrl: 'banner1.jpg' },
    { sortOrder: 2, imageUrl: 'banner2.jpg' },
  ],
  sections: [
    {
      title: 'Section 1',
      sortOrder: 1,
      images: [{ sortOrder: 1, imageUrl: 'section1-1.jpg' }],
    },
  ],
});
```

### 5. 환경 변수 설정

#### .env.test 파일

```env
NODE_ENV=test
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=seoul_moment_test
```

#### TypeORM 테스트 설정

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5433'),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [
    /* 엔티티 목록 */
  ],
  synchronize: true, // 테스트용으로만 true
  dropSchema: false, // 스키마 유지, 데이터만 정리
  logging: false, // 테스트 시 로깅 비활성화
});
```

### 6. 테스트 디버깅 팁

#### 테스트 실패 시 체크리스트

1. **Docker 컨테이너 상태 확인**: `docker ps`
2. **테스트 DB 로그 확인**: `npm run test:db:logs`
3. **실제 테이블 이름 확인**: PostgreSQL에 접속해서 `\dt` 명령
4. **포트 충돌 해결**: `npm run test:db:down && npm run test:db:up`
5. **완전 초기화**: Docker 볼륨까지 삭제 후 재시작

#### 단일 테스트 실행

```bash
npm run test:integration -- --testNamePattern="특정 테스트 이름"
```

### 7. 성능 최적화

#### 테스트 실행 시간 단축

- Docker 컨테이너는 가능한 한 번만 시작/종료
- `npm run test:full` 사용으로 자동화
- `test:integration:watch` 모드로 개발 시 빠른 피드백

#### 메모리 사용량 관리

- 각 테스트 후 완전한 데이터 정리
- `RESTART IDENTITY`로 시퀀스 초기화
- 테스트 간 데이터 누적 방지

### 8. 에러 해결 가이드

#### 자주 발생하는 에러와 해결책

**"relation does not exist" 에러**
→ 테이블 이름 확인, TypeORM naming strategy 고려

**"Empty criteria are not allowed for the delete method" 에러**
→ `repository.delete({})` 대신 `TRUNCATE` 사용

**"permission denied to set parameter" 에러**
→ PostgreSQL 권한 문제, 간단한 TRUNCATE 방식 사용

**외래키 제약조건 에러**
→ `createForeignKeyConstraints: process.env.NODE_ENV !== 'test'` 설정

**"deadlock detected" 에러**
→ Jest 설정에 `--runInBand` 옵션 추가로 테스트 순차 실행

### 9. 코드 품질 관리

#### 테스트 작성 원칙

- 각 테스트는 독립적이어야 함
- Given-When-Then 패턴 사용
- 의미있는 테스트 이름 작성
- 복잡한 시나리오는 여러 테스트로 분할

#### 테스트 커버리지

```bash
npm run test:cov  # 단위 테스트 커버리지
```

### 10. DB 관련 비즈니스 로직 테스트 전략

#### Service 및 Controller 테스트 원칙

**모든 DB 관련 비즈니스 로직은 실제 테스트 DB에 데이터를 넣고 확인하는 통합 테스트로 작성**

#### Service 테스트

- Repository mocking 대신 실제 테스트 DB 사용
- TestDataFactory를 활용한 실제 데이터 생성 및 검증
- DB 트랜잭션, 제약조건, 관계 매핑 등 실제 동작 검증

```typescript
describe('BrandService Integration Tests', () => {
  let brandService: BrandService;
  let testDataFactory: TestDataFactory;

  beforeEach(() => {
    const module = TestSetup.getModule();
    brandService = module.get<BrandService>(BrandService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  it('should return brand introduce with actual data', async () => {
    // Given: 실제 DB에 브랜드 데이터 생성
    const brand = await testDataFactory.createFullBrand({
      brand: { name: 'Test Brand', status: BrandStatus.NORMAL },
    });

    // When: 실제 서비스 호출
    const result = await brandService.getBrandIntroduce(brand.id);

    // Then: DB에서 가져온 실제 데이터 검증
    expect(result.name).toBe('Test Brand');
  });
});
```

#### Controller (E2E) 테스트

- supertest를 사용한 실제 HTTP 요청/응답 테스트
- 실제 테스트 DB와 연동된 완전한 요청 흐름 검증
- 인증, 권한, 예외 처리 등 실제 동작 검증

```typescript
describe('BrandController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;

  beforeEach(async () => {
    app = TestSetup.getApp();
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  it('GET /brand/:id - success', async () => {
    // Given: 실제 DB에 브랜드 데이터 생성
    const brand = await testDataFactory.createFullBrand();

    // When: 실제 HTTP 요청
    const response = await request(app.getHttpServer())
      .get(`/brand/${brand.id}`)
      .expect(200);

    // Then: 실제 응답 데이터 검증
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(brand.name);
  });
});
```

#### 테스트 격리 및 데이터 정리

- 각 테스트 후 TestSetup.clearDatabase() 호출로 완전한 데이터 정리
- 테스트 간 데이터 오염 방지
- 병렬 테스트 실행 시에도 안전한 격리 보장

---

## 11. E2E 테스트 설정 및 중요 사항

### E2E 테스트 파일 명명 규칙

- **E2E 테스트를 통합 테스트에 포함시키려면**: `*.spec.ts` 파일명 사용
- **별도 E2E 테스트로 실행하려면**: `*.e2e-spec.ts` 파일명 사용하고 `apps/api/test/` 경로에 위치

```bash
# 통합 테스트에 포함되는 경우
test/e2e/brand.controller.spec.ts    # ✅ test:integration에서 실행됨

# 별도 E2E 테스트인 경우
apps/api/test/brand.controller.e2e-spec.ts  # test:e2e에서 실행됨
```

### E2E 테스트 NestJS 애플리케이션 설정

#### 필수 임포트 및 설정

```typescript
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import request from 'supertest'; // ❌ import * as request from 'supertest';
import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';

describe('Controller (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ControllerModule, TestDatabaseModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // LoggerService 인스턴스 가져오기
    const logger = moduleFixture.get<LoggerService>(LoggerService);

    // 전역 파이프 및 필터 설정 (main.ts와 동일하게)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        transform: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        disableErrorMessages: false,
        validationError: {
          target: true,
          value: true,
        },
        exceptionFactory: (errors) => new BadRequestException(errors),
      }),
    );

    app.useGlobalFilters(
      new HttpExceptionFilter(logger),
      new ServiceErrorFilter(logger),
    );

    await app.init();
  });
});
```

#### TestDatabaseModule에 LoggerModule 추가

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.test',
      isGlobal: true,
    }),
    LoggerModule, // ✅ 필수 추가
    TypeOrmModule.forRoot({...}),
  ],
  exports: [TypeOrmModule, LoggerModule], // ✅ export에도 추가
})
export class TestDatabaseModule {}
```

### E2E 테스트 응답 구조 이해

#### 성공 응답 구조

```typescript
// 실제 API 응답 구조 (ResponseDataDto)
{
  "result": true,    // ❌ "success": true (X)
  "data": { ... }
}

// 테스트에서 올바른 검증 방법
expect(response.body).toHaveProperty('result', true);
expect(response.body).toHaveProperty('data');
```

#### 에러 응답 구조

```typescript
// ServiceError 응답 구조 (ServiceErrorFilter)
{
  "message": "Brand not found or not in normal status",
  "code": "NOT_FOUND_DATA",
  "tracdId": "0"
}

// 테스트에서 올바른 검증 방법
expect(response.body).toHaveProperty('code', ServiceErrorCode.NOT_FOUND_DATA);
expect(response.body).toHaveProperty('message', 'Brand not found or not in normal status');
```

#### ValidationPipe 에러 응답 구조

```typescript
// ValidationPipe 에러 응답 (400 Bad Request)
{
  "message": [...],
  "error": "Bad Request",
  "statusCode": 400
}

// 테스트에서 검증
expect(response.body).toHaveProperty('statusCode', 400);
```

### E2E 테스트 작성 시 주의사항

#### 1. supertest 임포트 방식

```typescript
// ✅ 올바른 방법
import request from 'supertest';

// ❌ 잘못된 방법
import * as request from 'supertest';
```

#### 2. 의존성 주입 확인

TestSetup에서 필요한 모든 서비스를 providers에 추가:

```typescript
// TestSetup.initialize()에서
this.module = await Test.createTestingModule({
  imports: [TestDatabaseModule],
  providers: [
    BrandRepositoryService,
    BrandService, // ✅ E2E에서 사용하는 서비스 추가
  ],
}).compile();
```

#### 3. 테스트 데이터 정리 타이밍

```typescript
// E2E 테스트에서도 동일하게
beforeEach(async () => {
  await TestSetup.clearDatabase(); // 각 테스트 전 정리
});
```

#### 4. Path Parameter 검증 및 ParseIntPipe 사용

```typescript
// ❌ 잘못된 방법: 타입만 지정하면 500 에러 발생
@Param('id') id: number

// ✅ 올바른 방법: ParseIntPipe로 400 에러와 명확한 메시지 제공
@Param('id', ParseIntPipe) id: number
```

**ParseIntPipe 사용 시 장점:**

- 잘못된 ID 입력 시 자동으로 400 Bad Request 반환
- 명확한 에러 메시지: `"Validation failed (numeric string is expected)"`
- NestJS 표준 방식으로 타입 안전성 보장

#### 5. HTTP 상태 코드 실제 동작 확인

```typescript
// ParseIntPipe 적용 후 테스트
const response = await request(app.getHttpServer())
  .get('/brand/invalid-id')
  .expect(400); // ParseIntPipe가 400 Bad Request 반환

// 응답 구조 검증
expect(response.body).toHaveProperty('statusCode', 400);
expect(response.body).toHaveProperty(
  'message',
  'Validation failed (numeric string is expected)',
);
expect(response.body).toHaveProperty('error', 'Bad Request');
```

---

## 참고사항

- 이 프로젝트는 실제 PostgreSQL을 사용한 통합 테스트 환경을 구축했습니다
- 모든 테스트는 격리된 상태로 실행되며, **29개 테스트 모두 통과**합니다
- E2E 테스트와 통합 테스트가 함께 실행되어 완전한 API 동작을 검증합니다
- **ParseIntPipe 적용**으로 잘못된 path parameter에 대한 적절한 400 에러 처리 구현
- **deadlock 방지**를 위한 `--runInBand` 옵션 적용으로 안정적인 테스트 실행
- 새로운 테스트 작성 시 위 가이드를 참고하여 안정적인 테스트 코드를 작성하세요

## 최근 해결 사항

### 2025-09-02: News & Article API Enhancement

- ✅ **News API 완전 구현**: 다국어 지원 뉴스 조회 API (`GET /news/:id`) 구현
- ✅ **Article API 완전 구현**: 다국어 지원 아티클 조회 API (`GET /article/:id`) 구현
- ✅ **LastArticle 기능**: 각 API에서 최신 3개 관련 콘텐츠 목록 제공 기능 구현
- ✅ **Performance Optimization**: `Promise.all`을 활용한 병렬 처리로 API 응답 속도 향상
- ✅ **Repository Service Enhancement**: `findLastArticleByCount()`, `findLastNewsByCount()` 메서드 추가
- ✅ **Complete Test Coverage**: Repository → Service → Controller → E2E 전 계층 테스트 구현
  - Article: Repository Service (6개 메서드), Service (8개 시나리오), Controller E2E (8개 테스트)
  - News: Repository Service (6개 메서드), Service (8개 시나리오), Controller E2E (8개 테스트)
- ✅ **Test Data Factory Enhancement**: Article 및 News 엔티티 생성 헬퍼 메서드 추가

#### 주요 API 구조

**Article API** (`GET /article/:id`)
```json
{
  "result": true,
  "data": {
    "id": 1,
    "writer": "Writer Name",
    "category": "Category Name",
    "title": "다국어 제목",
    "content": "다국어 내용",
    "banner": "https://domain/banner.jpg",
    "profileImage": "https://domain/profile.jpg",
    "lastArticle": [
      {"id": 2, "banner": "url", "title": "제목"},
      {"id": 3, "banner": "url", "title": "제목"},
      {"id": 4, "banner": "url", "title": "제목"}
    ],
    "section": [
      {
        "title": "섹션 제목",
        "subTitle": "섹션 부제목", 
        "content": "섹션 내용",
        "iamgeList": ["image1.jpg", "image2.jpg"]
      }
    ]
  }
}
```

**News API** (`GET /news/:id`)
- Article API와 동일한 구조
- Accept-Language 헤더로 다국어 지원 (ko, en, zh)
- 최신 3개 뉴스 목록 포함

#### 기술적 개선사항
- **병렬 처리**: Repository 조회와 다국어 텍스트 조회를 동시 처리
- **TypeORM 최적화**: `createDate DESC` 정렬과 `take` 제한으로 효율적인 최신 목록 조회
- **에러 처리**: 표준화된 ServiceError를 통한 일관된 404 처리
- **테스트 안정성**: `--runInBand` 옵션과 데이터 격리로 deadlock 방지

### 2025-09-01: Multilingual System Implementation

- ✅ **다국어 시스템 구축**: 한국어, 영어, 중국어 지원하는 완전한 multilingual 시스템 구현
- ✅ **Generic Entity System**: `MultilingualTextEntity`를 통한 확장 가능한 다국어 텍스트 저장 구조
- ✅ **Language Management**: `LanguageEntity`와 `LanguageCode` enum을 통한 언어 관리 시스템
- ✅ **API Multilingual Support**: Accept-Language 헤더를 통한 다국어 API 지원
- ✅ **Database Entity Updates**: Brand 및 BrandSection 엔티티에서 하드코딩된 텍스트 필드 제거
- ✅ **Test Environment Safety**: 실제 DB 데이터 보호를 위한 테스트 환경 검증 로직 추가
- ✅ **Complete Test Suite**: 70개 통합 테스트 모두 통과 (E2E, Service, Repository 모든 계층)
- ✅ **TestDataFactory Enhancement**: Multilingual 테스트 데이터 생성 지원 및 관계 로딩 최적화

#### 주요 기술 결정사항

- **No Fallback Policy**: Controller에서 fallback 로직 제거, 요청 언어에 해당하는 데이터만 반환
- **Entity Type Consistency**: 서비스와 테스트에서 일관된 entity type 사용 (`'brand'`, `'brand_section'`)
- **Test Safety First**: 환경변수 검증으로 실제 DB 데이터 보호 (NODE_ENV, DB_NAME, DB_PORT 검증)
- **Eager Loading with Manual Reload**: createFullBrand에서 관계 데이터 수동 재조회로 확실한 관계 로딩 보장

#### 이전 개발 사항 (같은 날)

- ✅ **dev-batch CI/CD 파이프라인 구축**: 별도 batch 애플리케이션 배포 워크플로우
- ✅ **ECS Task Definition 분리**: API용(`taskdef.json`)과 Batch용(`taskdef-batch.json`) 독립 관리
- ✅ **Redis TLS 연결 업데이트**: 보안 강화 및 연결 안정성 개선
- ✅ **Google Sheets 크롤링 기능**: 외부 데이터 수집 및 메일 서비스 연동
- ✅ **Health Check 최적화**: ECS taskdef에서 불필요한 health check 제거로 배포 안정성 향상

### 2025-08-29

- ✅ Redis 통합 테스트 환경 구축 (TestCacheModule, TestDatabaseModule 분리)
- ✅ 모듈별 독립적인 테스트 설정으로 불필요한 의존성 제거
- ✅ TestSetup 클래스 리팩토링으로 cache-only와 full-DB 테스트 지원
- ✅ 캐시 데이터 격리 문제 해결 (beforeEach에서 직접 캐시 정리)
- ✅ getModule() 의존성 제거하여 각 테스트가 독립적으로 모듈 생성

## 12. 통합 테스트 작성 표준 패턴 (2025-08-29)

### Cache-only 테스트 패턴

```typescript
import { CacheService } from '@app/cache/cache.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestCacheModule } from '../setup/test-cache.module';
import { TestSetup } from '../setup/test-setup';

describe('CacheService Integration Tests', () => {
  let cacheService: CacheService;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initializeCache();

    module = await Test.createTestingModule({
      imports: [TestCacheModule],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearCache();
  });
});
```

### DB + Cache 통합 테스트 패턴

```typescript
import { ServiceError } from '@app/common/exception/service.error';
import { Test, TestingModule } from '@nestjs/testing';

import { BrandModule } from '../../apps/api/src/module/brand/brand.module';
import { BrandService } from '../../apps/api/src/module/brand/brand.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('BrandService Integration Tests', () => {
  let brandService: BrandService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, BrandModule],
    }).compile();

    brandService = module.get<BrandService>(BrandService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });
});
```

### Repository 서비스 테스트 패턴

```typescript
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('BrandRepositoryService Integration Tests', () => {
  let brandRepositoryService: BrandRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [BrandRepositoryService],
    }).compile();

    brandRepositoryService = module.get<BrandRepositoryService>(
      BrandRepositoryService,
    );
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });
});
```

### E2E 테스트 패턴

```typescript
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { BrandModule } from '../../apps/api/src/module/brand/brand.module';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('BrandController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    moduleFixture = await Test.createTestingModule({
      imports: [BrandModule, TestDatabaseModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 전역 설정 추가...

    await app.init();
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });
});
```

### 중요 규칙

#### 1. Module Import 우선순위

```typescript
// ✅ 올바른 방법: 관련 Module을 import하면 모든 의존성 자동 해결
module = await Test.createTestingModule({
  imports: [TestDatabaseModule, BrandModule],
}).compile();

// ❌ 잘못된 방법: providers에 중복 추가
module = await Test.createTestingModule({
  imports: [TestDatabaseModule, BrandModule],
  providers: [BrandService], // 불필요한 중복
}).compile();
```

#### 2. 상대 경로 사용

```typescript
// ✅ 올바른 방법
import { BrandModule } from '../../apps/api/src/module/brand/brand.module';

// ❌ 잘못된 방법
import { BrandModule } from 'apps/api/src/module/brand/brand.module';
```

#### 3. TestSetup 사용법

```typescript
// Cache만 필요한 경우
await TestSetup.initializeCache();

// DB + Cache 모두 필요한 경우
await TestSetup.initialize();

// 각 테스트 전 정리
beforeEach(async () => {
  await TestSetup.clearDatabase(); // DB + Cache 정리
  // 또는
  await TestSetup.clearCache(); // Cache만 정리
});
```

#### 4. 캐시 격리가 중요한 경우

```typescript
beforeEach(async () => {
  // TestSetup 정리 + 직접 정리로 확실한 격리 보장
  try {
    await cacheService.del(RedisKey.SPECIFIC_KEY);

    const keys = await cacheService.scan('*');
    for (const key of keys) {
      await cacheService.del(key);
    }
  } catch (error) {
    console.warn('Failed to clear cache in beforeEach:', error.message);
  }
});
```

### 테스트 실행

```bash
npm run test:full  # 전체 테스트 (권장)
```

---

## 이전 해결 사항 (2025-08-26)

- ✅ ParseIntPipe 도입으로 path parameter 검증 강화
- ✅ deadlock 에러 해결 (--runInBand 옵션)
- ✅ 데이터 정리 타이밍 최적화 (afterEach 사용)
- ✅ 29개 테스트 100% 통과 달성
- 테스트 실행은 무조건 test:full로 한다
- 앞으로 Entity 관련 service 테스트 repository service 테스트 할땐 test.data.factory 나 test-database.module 에 추가 되어야 해

## 13. 테스트 환경 안전성 가이드 (2025-09-01)

### 실제 DB 데이터 보호를 위한 필수 안전장치

#### TestSetup 환경 검증 로직

```typescript
export class TestSetup {
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

  static async initialize(): Promise<void> {
    this.validateTestEnvironment(); // 모든 초기화 전에 검증
    // ... 나머지 초기화 로직
  }
}
```

#### 안전장치 구성 요소

1. **NODE_ENV 검증**: 반드시 'test'여야 함
2. **DB 이름 검증**: 'test'가 포함되어야 함 (`seoul_moment_test`)
3. **포트 검증**: 5433 (테스트 전용 포트)이어야 함
4. **초기화 시점 검증**: 모든 TestSetup.initialize() 호출 시 자동 검증

#### 추가 보호 방안

- **환경변수 파일 분리**: `.env.test` 파일 사용으로 테스트 환경 독립성 보장
- **Docker 컨테이너 격리**: 테스트용 PostgreSQL/Redis 컨테이너 사용
- **포트 분리**: 개발용(5432/6379)과 테스트용(5433/6380) 포트 분리

#### 위험 상황 예방

```bash
# ❌ 위험한 상황들
NODE_ENV=production npm run test:integration  # 에러 발생
NODE_ENV=development npm run test:integration # 에러 발생
DATABASE_NAME=seoul_moment_prod npm run test  # 에러 발생

# ✅ 안전한 실행
NODE_ENV=test npm run test:integration        # 정상 실행
npm run test:full                             # 정상 실행 (NODE_ENV=test 자동 설정)
```

**중요**: 이 안전장치로 인해 잘못된 환경에서 테스트 실행 시 즉시 에러가 발생하여 실제 DB 데이터를 보호합니다.

## 14. 새로운 엔티티 테스트 환경 설정 가이드 (2025-09-02)

### 새로운 엔티티 추가 시 필수 작업

새로운 엔티티의 테스트를 작성하기 전에 **반드시** 다음 두 파일을 업데이트해야 합니다:

#### 1. TestDatabaseModule에 엔티티 등록

`test/setup/test-database.module.ts` 파일을 수정:

```typescript
// 1. Import 구문 추가
import { NewEntity } from '@app/repository/entity/new.entity';

@Module({
  imports: [
    TestCacheModule,
    TypeOrmModule.forRoot({
      // 2. entities 배열에 추가
      entities: [
        BrandEntity,
        BrandBannerImageEntity,
        BrandSectionEntity,
        BrandSectionImageEntity,
        LanguageEntity,
        MultilingualTextEntity,
        NewEntity, // ✅ 새 엔티티 추가
      ],
      // ... 나머지 설정
    }),
    // 3. TypeOrmModule.forFeature에도 추가
    TypeOrmModule.forFeature([
      BrandEntity,
      BrandBannerImageEntity,
      BrandSectionEntity,
      BrandSectionImageEntity,
      LanguageEntity,
      MultilingualTextEntity,
      NewEntity, // ✅ 새 엔티티 추가
    ]),
  ],
})
```

#### 2. TestDataFactory에 헬퍼 메서드 추가

`test/setup/test-data.factory.ts` 파일에 새 엔티티 생성 메서드 추가:

```typescript
// Import 추가
import { NewEntity } from '@app/repository/entity/new.entity';

export class TestDataFactory {
  /**
   * 새로운 엔티티 생성
   */
  async createNewEntity(
    overrides: Partial<NewEntity> = {},
  ): Promise<NewEntity> {
    const repository = this.dataSource.getRepository(NewEntity);

    const entity = repository.create({
      // 기본값들 설정
      status: EntityStatus.ACTIVE,
      name: 'Test Entity',
      ...overrides,
    });

    return repository.save(entity);
  }

  /**
   * 관계가 있는 엔티티 생성 (예: Brand와 관련된 엔티티)
   */
  async createNewEntityWithBrand(
    brand: BrandEntity,
    overrides: Partial<NewEntity> = {},
  ): Promise<NewEntity> {
    return this.createNewEntity({
      brandId: brand.id,
      ...overrides,
    });
  }

  /**
   * 다국어 지원이 필요한 엔티티 생성
   */
  async createMultilingualNewEntity(
    entityData: Partial<NewEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
      description?: { [key in LanguageCode]?: string };
    },
  ): Promise<{
    entity: NewEntity;
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
    texts: MultilingualTextEntity[];
  }> {
    // 엔티티 생성
    const entity = await this.createNewEntity(entityData);

    // 언어 생성
    const languages = await this.createDefaultLanguages();

    // 다국어 텍스트 생성
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.name) {
      for (const [langCode, content] of Object.entries(multilingualData.name)) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.createMultilingualText(
            EntityEnum.NEW_ENTITY, // EntityEnum에도 추가 필요
            entity.id,
            'name',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    return { entity, languages, texts };
  }
}
```

### 현재 지원하는 엔티티 목록 (2025-09-02 기준)

TestDatabaseModule과 TestDataFactory에 등록된 엔티티들:

- ✅ `BrandEntity` - 브랜드 기본 정보
- ✅ `BrandBannerImageEntity` - 브랜드 배너 이미지
- ✅ `BrandSectionEntity` - 브랜드 정보 섹션
- ✅ `BrandSectionImageEntity` - 브랜드 섹션 이미지
- ✅ `LanguageEntity` - 언어 정보
- ✅ `MultilingualTextEntity` - 다국어 텍스트

### 새 엔티티 추가 체크리스트

새로운 엔티티(예: News, Article 등)의 테스트를 구현할 때:

#### □ 1. TestDatabaseModule 업데이트

- [ ] Import 구문 추가
- [ ] `entities` 배열에 추가
- [ ] `TypeOrmModule.forFeature` 배열에 추가

#### □ 2. TestDataFactory 업데이트

- [ ] Import 구문 추가
- [ ] 기본 생성 메서드 추가 (`createNewEntity`)
- [ ] 관계 엔티티 생성 메서드 추가 (필요 시)
- [ ] 다국어 지원 메서드 추가 (필요 시)

#### □ 3. EntityEnum 업데이트 (다국어 지원 시)

- [ ] `libs/repository/src/enum/entity.enum.ts`에 새 엔티티 타입 추가

#### □ 4. 테스트 작성 전 확인

- [ ] `npm run test:full` 실행하여 기존 테스트가 통과하는지 확인
- [ ] 새 엔티티 관련 테스트 작성
- [ ] 모든 테스트 통과 확인

### 실제 사용 예시

```typescript
describe('NewEntityService Integration Tests', () => {
  let newEntityService: NewEntityService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, NewEntityModule],
    }).compile();

    newEntityService = module.get<NewEntityService>(NewEntityService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  it('should create new entity successfully', async () => {
    // Given: TestDataFactory로 테스트 데이터 생성
    const entity = await testDataFactory.createNewEntity({
      name: 'Test Entity',
      status: EntityStatus.ACTIVE,
    });

    // When: 서비스 호출
    const result = await newEntityService.findById(entity.id);

    // Then: 검증
    expect(result.name).toBe('Test Entity');
  });
});
```

### 중요 주의사항

1. **양쪽 모두 추가 필수**: TestDatabaseModule과 TestDataFactory 둘 다 업데이트해야 함
2. **Import 경로 확인**: `@app/repository/entity/` 경로 사용
3. **테스트 실행**: 항상 `npm run test:full`로 실행
4. **데이터 정리**: 각 테스트 후 `TestSetup.clearDatabase()` 호출로 데이터 격리 보장

**이 가이드를 따르지 않으면 테스트 실행 시 엔티티를 찾을 수 없다는 에러가 발생합니다.**
- @test/setup/test-data.factory.ts 에 createMultilingualText 메서드 를 테스트 코드에서 사용할떄 매개변수 EntityType을 꼭 사용해
- 메서드를 하나 바꿨을때 그 메서드를 사용하고 있거나 영향을 주는 코드는 반듯히 확인하고 고쳐야함

---

## 15. 상품 옵션 관리 시스템 (Product-Variant Pattern)

### 개요

의류 등 옵션이 있는 상품을 체계적으로 관리하기 위한 데이터베이스 설계입니다. Shopify, 우아한형제들 등 대형 이커머스에서 사용하는 **Product-Variant 패턴**을 적용했습니다.

### 핵심 개념

#### Product vs ProductVariant
- **Product**: 상품군 (예: "나이키 드라이핏 티셔츠") - 기본 정보, 설명, 브랜드
- **ProductVariant**: 실제 판매 상품 (예: "나이키 드라이핏 티셔츠 빨강 M사이즈") - SKU, 가격, 재고

#### SKU (Stock Keeping Unit)
재고 관리 단위를 뜻하는 고유 식별 코드입니다.
- 예시: `NK-DF-001-RED-M` = 나이키-드라이핏-001번상품-빨강-M사이즈
- 재고, 가격, 주문 처리 모두 SKU 단위로 관리

### 데이터베이스 스키마 설계

#### 핵심 테이블 구조

```
1. Product (상품 기본 정보)
   ├── id, name, description, brand_id, status
   └── 다국어 지원 (MultilingualText 연결)

2. Option (옵션 종류)
   ├── id, type, name, sort_order  
   └── 예: COLOR(색상), SIZE(사이즈), MATERIAL(소재)

3. OptionValue (옵션 값)
   ├── id, option_id, value, color_code, sort_order
   └── 예: 빨강, M사이즈, 면100%

4. ProductVariant (실제 판매 상품) ★ 핵심 테이블
   ├── id, product_id, sku, price, discount_price
   ├── stock_quantity, barcode, weight
   ├── image_urls, is_active, status
   └── 실제 구매하는 단위

5. VariantOption (변형-옵션값 연결)
   ├── variant_id, option_value_id
   └── N:M 관계 매핑 테이블
```

#### 테이블 간 관계

```
Product 1:N ProductVariant
Option 1:N OptionValue  
ProductVariant N:M OptionValue (via VariantOption)
Brand 1:N Product
```

### 실제 동작 시나리오

#### 1. 상품 등록 과정

관리자가 "기본 스웨터"를 등록할 때:

```
Product: "기본 스웨터" 생성

실제 등록되는 ProductVariant들:
├── "기본 스웨터 빨강 M사이즈" (SKU: SW001-RED-M, 가격: 59,000원, 재고: 10개)
├── "기본 스웨터 빨강 L사이즈" (SKU: SW001-RED-L, 가격: 59,000원, 재고: 5개)
├── "기본 스웨터 파랑 M사이즈" (SKU: SW001-BLU-M, 가격: 62,000원, 재고: 8개)
└── "기본 스웨터 파랑 L사이즈" (SKU: SW001-BLU-L, 가격: 62,000원, 재고: 3개)
```

#### 2. 사용자 옵션 선택 → ProductVariant 매핑

사용자가 상품 페이지에서 옵션을 선택하면:

```
1. 상품 페이지 표시: "기본 스웨터"
   옵션 선택UI:
   ├── 색상: ○빨강 ○파랑  
   └── 사이즈: ○M ○L

2. 사용자 선택: 빨강 + M사이즈

3. 시스템 처리:
   색상 "빨강" → OptionValue ID: 101
   사이즈 "M" → OptionValue ID: 201
   
4. ProductVariant 조회 쿼리:
   SELECT pv.* 
   FROM product_variant pv
   JOIN variant_option vo1 ON pv.id = vo1.variant_id AND vo1.option_value_id = 101
   JOIN variant_option vo2 ON pv.id = vo2.variant_id AND vo2.option_value_id = 201
   WHERE pv.product_id = 상품ID

5. 결과: SKU "SW001-RED-M" ProductVariant 매핑 완료
   ├── 가격: 59,000원 표시
   ├── 재고: 10개 (구매 가능)
   └── 장바구니: 이 ProductVariant가 담김
```

#### 3. SQL 쿼리 동작 원리

**옵션이 3개인 경우 (색상 + 사이즈 + 소재):**

```sql
-- 사용자 선택: 빨강(101) + M(201) + 면100%(301)
SELECT pv.* 
FROM product_variant pv
JOIN variant_option vo1 ON pv.id = vo1.variant_id AND vo1.option_value_id = 101  -- 빨강
JOIN variant_option vo2 ON pv.id = vo2.variant_id AND vo2.option_value_id = 201  -- M사이즈  
JOIN variant_option vo3 ON pv.id = vo3.variant_id AND vo3.option_value_id = 301  -- 면100%
WHERE pv.product_id = 상품ID
```

**JOIN의 교집합 원리:**
- vo1: "이 variant가 빨강을 가지고 있나?"
- vo2: "이 variant가 M 사이즈도 가지고 있나?"  
- vo3: "이 variant가 면100%도 가지고 있나?"
- **세 조건을 모두 만족하는 variant만 결과로 반환**

### 테이블 데이터 예시

#### variant_option 테이블 (연결 테이블)
| variant_id | option_value_id | 설명 |
|------------|-----------------|------|
| 1          | 101            | 빨강 |
| 1          | 201            | M |
| 1          | 301            | 면100% |
| 2          | 101            | 빨강 |
| 2          | 201            | M |
| 2          | 302            | 폴리에스터 |

#### 쿼리 실행 결과
- **variant 1번**: 빨강 + M + 면100% ✅ (3개 조건 모두 만족)
- **variant 2번**: 빨강 + M + 폴리에스터 ❌ (소재가 다름)

### 시스템 장점

#### 1. 확장성
- 새로운 옵션 타입 (핏, 스타일 등) 쉽게 추가
- 옵션값 재사용 (색상 "빨강"은 여러 상품에서 사용)

#### 2. 성능
- 적절한 인덱스 설계로 빠른 조회 성능
- 옵션이 많아져도 JOIN 방식으로 효율적 처리

#### 3. 관리 편의성
- 재고/가격은 실제 판매 단위(ProductVariant)로 관리
- SKU 기반의 체계적인 상품 추적

#### 4. 데이터 무결성
- 복합 키와 외래키 제약조건으로 데이터 정합성 보장
- 논리적 삭제로 히스토리 보존

### 구현 고려사항

#### Entity 설계 시 주의점
- ProductVariant가 실제 비즈니스 로직의 핵심
- 모든 상품 관련 enum은 확장 가능하게 설계
- 테스트 환경에서는 외래키 제약조건 비활성화

#### 성능 최적화
- variant_id, option_value_id 복합 인덱스 필수
- product_id, sku에 개별 인덱스 생성
- 자주 조회되는 컬럼(price, stock_quantity)에 인덱스 고려

#### 테스트 환경 설정
- TestDatabaseModule에 모든 상품 관련 Entity 등록
- TestDataFactory에서 복잡한 옵션 조합 테스트 데이터 생성 지원

### 다국어 지원 시스템

상품 옵션 시스템은 기존 프로젝트의 MultilingualText 시스템을 활용하여 완전한 다국어 지원을 제공합니다.

#### 다국어 지원 전략

**기존 MultilingualText 시스템 확장 활용:**
- 일관성: Brand, News, Article과 동일한 패턴 적용
- 확장성: 새 언어(일본어, 베트남어 등) 쉽게 추가 가능
- 유지보수: 중앙화된 다국어 시스템으로 관리

**지원 언어:**
- 한국어 (ko) - 기본 언어
- 영어 (en)
- 중국어 (zh)

#### 다국어 지원 대상 Entity 및 필드

##### 1. ProductEntity (상품 기본 정보)
```
다국어 필드:
├── name (상품명): "나이키 드라이핏 티셔츠" → "Nike Dri-FIT T-Shirt" → "耐克Dri-FIT T恤"
└── description (상품 설명): 상세 설명의 다국어 버전
```

##### 2. OptionEntity (옵션 종류)
```
다국어 필드:
├── name (옵션명): "색상" → "Color" → "颜色"
└── description (옵션 설명): 옵션에 대한 설명 (필요 시)
```

##### 3. OptionValueEntity (옵션 값) ⭐ 가장 중요!
```
다국어 필드:
├── value (옵션값): "빨강" → "Red" → "红色"
│                   "M사이즈" → "M Size" → "M码"
│                   "면100%" → "100% Cotton" → "100%棉"
└── description (옵션값 설명): 필요 시 상세 설명
```

#### 구현 방식

##### EntityType enum 확장
```typescript
export enum EntityType {
  // 기존
  BRAND = 'brand',
  BRAND_SECTION = 'brand_section',
  NEWS = 'news',
  ARTICLE = 'article',
  
  // 상품 관련 추가
  PRODUCT = 'product',
  OPTION = 'option',
  OPTION_VALUE = 'option_value',
}
```

##### Entity별 다국어 관계 추가
```typescript
// 모든 상품 관련 Entity에 추가
@OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
  cascade: true,
  createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
})
multilingualTexts: MultilingualTextEntity[];
```

#### 다국어 데이터 저장 구조

**multilingual_text 테이블 예시:**
| entityType | entityId | fieldName | languageId | textContent |
|------------|----------|-----------|------------|-------------|
| option_value | 101 | value | 1 (한국어) | 빨강 |
| option_value | 101 | value | 2 (영어) | Red |
| option_value | 101 | value | 3 (중국어) | 红色 |
| option_value | 201 | value | 1 (한국어) | M사이즈 |
| option_value | 201 | value | 2 (영어) | M Size |
| option_value | 201 | value | 3 (중국어) | M码 |

#### 다국어 API 동작 시나리오

##### 1. 사용자별 언어 설정
```http
GET /product/1
Accept-Language: en

응답:
{
  "name": "Nike Dri-FIT T-Shirt",
  "description": "Premium athletic t-shirt...",
  "options": [
    {
      "name": "Color",
      "values": ["Red", "Blue", "Black"]
    },
    {
      "name": "Size", 
      "values": ["S", "M", "L", "XL"]
    }
  ]
}
```

##### 2. 옵션 선택 UI 다국어 표시
```
영어 사용자:
├── Color: ○Red ○Blue ○Black
└── Size: ○S ○M ○L ○XL

중국어 사용자:
├── 颜色: ○红色 ○蓝色 ○黑色  
└── 尺码: ○S ○M ○L ○XL
```

##### 3. 상품 변형 매핑과 다국어
```
사용자 선택 (영어): Red + M Size
시스템 처리: 
1. "Red" → OptionValue ID: 101
2. "M Size" → OptionValue ID: 201  
3. ProductVariant 조회 및 매핑
4. 결과: "Nike T-Shirt Red M Size" (영어로 표시)

사용자 선택 (중국어): 红色 + M码
시스템 처리:
1. "红色" → OptionValue ID: 101  
2. "M码" → OptionValue ID: 201
3. ProductVariant 조회 및 매핑 (동일한 ID)
4. 결과: "耐克T恤 红色 M码" (중국어로 표시)
```

#### 개발 시 고려사항

##### TestDataFactory 다국어 지원
```typescript
// 다국어 상품 생성 헬퍼 메서드
async createMultilingualProduct(
  productData: Partial<ProductEntity>,
  multilingualData: {
    name: { ko: string; en: string; zh: string };
    description?: { ko: string; en: string; zh: string };
  }
): Promise<{
  product: ProductEntity;
  languages: { korean: LanguageEntity; english: LanguageEntity; chinese: LanguageEntity };
  texts: MultilingualTextEntity[];
}>

// 다국어 옵션값 생성
async createMultilingualOptionValue(
  optionValueData: Partial<OptionValueEntity>,
  multilingualData: {
    value: { ko: string; en: string; zh: string };
  }
): Promise<{...}>
```

##### API 응답 최적화
- 사용자 언어별 캐싱 전략
- 필요한 언어의 텍스트만 조회하는 효율적 쿼리
- Accept-Language 헤더 파싱 및 기본값 처리

##### 성능 최적화
```sql
-- 다국어 텍스트 조회 최적화
CREATE INDEX idx_multilingual_text_lookup 
ON multilingual_text(entity_type, entity_id, field_name, language_id);

-- 상품 옵션 조회 시 다국어 텍스트 함께 조회
SELECT pv.*, mt.text_content 
FROM product_variant pv
JOIN variant_option vo ON pv.id = vo.variant_id
JOIN option_value ov ON vo.option_value_id = ov.id
JOIN multilingual_text mt ON mt.entity_type = 'option_value' 
                          AND mt.entity_id = ov.id 
                          AND mt.field_name = 'value'
                          AND mt.language_id = :languageId
WHERE pv.product_id = :productId;
```

#### 테스트 환경 다국어 설정

```typescript
// 테스트 데이터 생성 예시
describe('Multilingual Product Tests', () => {
  it('should create product with multilingual options', async () => {
    // Given: 다국어 옵션값 생성
    const { optionValue } = await testDataFactory.createMultilingualOptionValue(
      { sortOrder: 1 },
      {
        value: {
          ko: '빨강',
          en: 'Red', 
          zh: '红色'
        }
      }
    );

    // When: 영어로 옵션값 조회
    const result = await optionService.getOptionValue(optionValue.id, 'en');

    // Then: 영어 텍스트 반환 확인
    expect(result.value).toBe('Red');
  });
});
```

**이 다국어 시스템으로 글로벌 사용자를 위한 완전한 상품 옵션 관리가 가능합니다.**

---

이 시스템으로 확장성과 성능을 모두 확보한 상품 옵션 관리가 가능합니다.
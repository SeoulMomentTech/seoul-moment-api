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

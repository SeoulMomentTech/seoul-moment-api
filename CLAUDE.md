# Seoul Moment API - Claude 개발 가이드

> **다국어 지원 이커머스 API 개발을 위한 필수 가이드**  
> Node.js + NestJS + TypeORM + PostgreSQL + Redis 기반 통합 테스트 환경

## 🚀 빠른 시작 가이드

### 필수 명령어

```bash
# 전체 테스트 실행 (권장)
npm run test:full

# 개발 시 테스트
npm run test:integration:watch
```

### 새 엔티티 추가 시 필수 체크리스트

#### ✅ 반드시 해야 할 작업
1. **TestDatabaseModule**에 엔티티 등록 (`test/setup/test-database.module.ts`)
2. **TestDataFactory**에 헬퍼 메서드 추가 (`test/setup/test-data.factory.ts`)
3. **EntityType enum**에 타입 추가 (다국어 지원 시)

#### ✅ Entity 설정 패턴
```typescript
// 모든 관계에 필수 적용
@ManyToOne(() => ParentEntity, (parent) => parent.children, {
  onDelete: 'CASCADE',
  createForeignKeyConstraints: process.env.NODE_ENV !== 'test', // 🔥 필수
})
// eager: true 사용 금지 ❌
```

---

## 🏗️ 프로젝트 아키텍처

### 엔티티 구조
**현재 구현된 엔티티들:**
- **브랜드**: Brand, BrandSection, BrandBannerImage, BrandSectionImage
- **콘텐츠**: Article, News (섹션 및 이미지 포함)
- **홈페이지**: HomeBanner, HomeSection (이미지 포함)
- **다국어**: Language, MultilingualText
- **상품**: Product, ProductVariant, Option, OptionValue, ProductImage ⭐
- **카테고리**: Category, ProductCategory

### 핵심 패턴
1. **다국어 지원**: `MultilingualTextEntity` 활용한 완전 다국어 시스템
2. **Product-Variant 패턴**: Shopify 스타일 상품 옵션 관리
3. **테스트 안전성**: 실제 DB 보호를 위한 3중 검증 시스템
4. **모듈형 Factory**: Entity별 분리된 TestDataFactory 구조

---

## 🧪 테스트 작성 가이드

### 표준 테스트 패턴

#### Service 테스트
```typescript
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

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });
});
```

#### E2E 테스트 
```typescript
// ✅ 올바른 import
import request from 'supertest';

// ✅ 응답 구조 검증
expect(response.body).toHaveProperty('result', true); // ❌ success가 아님
expect(response.body).toHaveProperty('data');

// ✅ ParseIntPipe 사용
@Param('id', ParseIntPipe) id: number
```

### 테스트 작성 시 주의사항

#### 🔥 자주 하는 실수들
```typescript
// ❌ 잘못된 방법들
expect(error.errorCode).toBe(ServiceErrorCode.NOT_FOUND_DATA);
expect(response.body.success).toBe(true);
import * as request from 'supertest';
@Param('id') id: number

// ✅ 올바른 방법들
expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
expect(response.body.result).toBe(true);
import request from 'supertest';
@Param('id', ParseIntPipe) id: number
```

#### TestDataFactory 활용
```typescript
// 복잡한 다국어 데이터 생성
const { brand, languages, texts } = await testDataFactory.createMultilingualBrand(
  { status: BrandStatus.NORMAL },
  {
    name: { ko: '한국 브랜드', en: 'Korean Brand', zh: '韩国品牌' },
    description: { ko: '설명', en: 'Description', zh: '描述' }
  }
);
```

---

## 🔒 테스트 환경 안전성 (실제 DB 보호)

### 3중 안전장치 시스템
```typescript
// TestSetup에서 자동 검증
private static validateTestEnvironment(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`DANGER: NODE_ENV=${process.env.NODE_ENV}`);
  }
  if (!process.env.DATABASE_NAME?.includes('test')) {
    throw new Error(`DANGER: DB must contain 'test'`);
  }
  if (process.env.DATABASE_PORT !== '5433') {
    throw new Error(`DANGER: Must use test port 5433`);
  }
}
```

**결과**: 잘못된 환경에서 테스트 실행 시 즉시 중단 → 실제 DB 데이터 보호 ✅

---

## 🎯 다국어 시스템

### 지원 언어
- **한국어 (ko)** - 기본 언어
- **영어 (en)**
- **중국어 (zh)**

### API 다국어 동작
```http
GET /brand/1
Accept-Language: en

{
  "result": true,
  "data": {
    "id": 1,
    "name": "Korean Brand",  // 영어로 반환
    "description": "Description in English"
  }
}
```

### 다국어 테스트 데이터 생성
```typescript
// createMultilingualText 사용 시 EntityType 필수!
const text = await testDataFactory.createMultilingualText(
  EntityType.BRAND,  // 🔥 필수 매개변수
  brand.id,
  'name',
  language,
  '브랜드명'
);
```

---

## 🛒 Product-Variant 시스템 (이커머스 핵심)

### 핵심 개념
- **Product**: 상품군 ("나이키 티셔츠")
- **ProductVariant**: 실제 판매 단위 ("나이키 티셔츠 빨강 M사이즈")
- **SKU**: 재고 관리 코드 (`NK-TS-RED-M`)

### 옵션 선택 → 상품 매핑 과정
```sql
-- 사용자가 빨강(101) + M사이즈(201) 선택 시
SELECT pv.* FROM product_variant pv
JOIN variant_option vo1 ON pv.id = vo1.variant_id AND vo1.option_value_id = 101  -- 빨강
JOIN variant_option vo2 ON pv.id = vo2.variant_id AND vo2.option_value_id = 201  -- M
WHERE pv.product_id = :productId
-- 결과: 조건을 모두 만족하는 variant만 반환
```

### TestDataFactory 활용
```typescript
const product = await testDataFactory.createFullProduct({
  options: [{
    type: OptionType.COLOR,
    name: { ko: '색상', en: 'Color', zh: '颜色' },
    values: [{
      value: { ko: '빨강', en: 'Red', zh: '红色' },
      colorCode: '#FF0000'
    }]
  }],
  variants: [{
    sku: 'TEST-RED-M',
    optionValueIds: [101, 201]  // 빨강 + M사이즈
  }]
});
```

---

## 🚨 자주 발생하는 에러와 해결책

### TypeScript/컴파일 에러
- **"Cannot find module"** → TestDatabaseModule에 엔티티 추가 안함
- **"Property does not exist"** → TestDataFactory 메서드 시그니처 불일치
- **Overload 에러** → `Parameters<T>` 대신 명시적 시그니처 정의

### 테스트 실행 에러  
- **"relation does not exist"** → 실제 테이블명 확인 필요
- **"DANGER: Test database"** → 환경변수 잘못 설정
- **"deadlock detected"** → `--runInBand` 옵션 누락
- **외래키 제약조건 에러** → Entity에 `createForeignKeyConstraints: false` 추가

### 데이터 관련 에러
- **Eager loading 의존** → `relations` 옵션으로 명시적 로딩
- **정렬 문제** → TypeORM은 eager loading 시 정렬 보장 안함
- **ServiceError 테스트** → `.getCode()` 메서드 사용

---

## 📋 개발 요청 시 체크리스트

### 새로운 기능 개발 시 놓치면 안 되는 것들

#### ✅ Entity 관련 작업
1. **Entity 설계**
   - `createForeignKeyConstraints: process.env.NODE_ENV !== 'test'` 모든 관계에 추가
   - `eager: true` 사용 금지
   - 다국어 필드 → MultilingualText 연결

2. **테스트 환경 업데이트**
   - TestDatabaseModule에 엔티티 등록
   - TestDataFactory에 생성 메서드 추가
   - EntityType enum 업데이트 (다국어 시)

#### ✅ API 개발 시
1. **Controller**
   - ParseIntPipe 사용 (`@Param('id', ParseIntPipe)`)
   - Accept-Language 헤더 지원
   - ResponseData 래퍼 사용

2. **Service**
   - ServiceError 표준 에러 처리
   - Promise.all 병렬 처리 최적화
   - 다국어 텍스트 조회

3. **테스트 작성**
   - Repository → Service → Controller → E2E 전 계층 테스트
   - 다국어 시나리오 테스트
   - 에러 케이스 테스트

#### ✅ 메서드 변경 시
- **영향받는 모든 코드 확인 필수!**
- TestDataFactory 메서드 변경 시 → 모든 테스트 파일 점검
- Entity 관계 변경 시 → Repository Service 점검
- API 응답 구조 변경 시 → E2E 테스트 점검

---

## 💡 개발 생산성 팁

### 자주 사용하는 명령어
```bash
# 테스트 관련
npm run test:full                    # 전체 테스트
npm run test:integration:watch       # watch 모드
npm run test:integration -- --testNamePattern="Brand"  # 특정 테스트

# Docker 관련
npm run test:db:up                   # 테스트 DB 시작
npm run test:db:down                 # 테스트 DB 종료
npm run test:db:logs                 # DB 로그 확인
```

### TestDataFactory 활용법
```typescript
// 간단한 데이터 생성
const brand = await testDataFactory.createBrand();

// 복잡한 관계 데이터 생성 
const brand = await testDataFactory.createFullBrand({
  bannerCount: 2,
  sectionCount: 3,
  imagesPerSection: 2
});

// 다국어 데이터 생성
const { brand } = await testDataFactory.createMultilingualBrand(
  { status: BrandStatus.NORMAL },
  { name: { ko: '브랜드', en: 'Brand' } }
);
```

---

## 📚 상세 기술 문서 (필요시 참조)

<details>
<summary>E2E 테스트 상세 설정</summary>

### E2E 테스트 파일 명명 규칙

- **E2E 테스트를 통합 테스트에 포함시키려면**: `*.spec.ts` 파일명 사용
- **별도 E2E 테스트로 실행하려면**: `*.e2e-spec.ts` 파일명 사용하고 `apps/api/test/` 경로에 위치

### 필수 임포트 및 설정

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

</details>

<details>
<summary>통합 테스트 작성 표준 패턴</summary>

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

</details>

<details>
<summary>새로운 엔티티 테스트 환경 설정 상세 가이드</summary>

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
}
```

</details>

<details>
<summary>상품 옵션 관리 시스템 상세 설계</summary>

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

</details>

---

## 📖 최근 개발 성과

### 2025-09-05: TestDataFactory 모듈화 완료
- ✅ **Factory 분리**: 1,752라인 거대 파일을 7개 모듈로 분리
- ✅ **TypeScript 안전성**: 오버로드 메서드 시그니처 완벽 보존
- ✅ **후방 호환성**: 기존 테스트 코드 변경 없이 100% 호환
- ✅ **유지보수성**: Entity별 관심사 분리로 코드 관리 용이

### 2025-09-02: News & Article API 완전 구현
- ✅ **다국어 API**: Accept-Language 헤더 지원 완료
- ✅ **병렬 처리**: Promise.all로 API 응답 속도 최적화
- ✅ **완전한 테스트**: Repository → Service → Controller → E2E 전 계층

### 2025-09-01: 다국어 시스템 구축
- ✅ **Generic 시스템**: MultilingualTextEntity 기반 확장 가능 구조
- ✅ **3중 안전장치**: 테스트 환경에서 실제 DB 데이터 보호
- ✅ **70개 테스트**: 모든 통합 테스트 100% 통과

---

**이 가이드로 안전하고 효율적인 Seoul Moment API 개발이 가능합니다! 🚀**
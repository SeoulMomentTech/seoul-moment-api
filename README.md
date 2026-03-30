# Seoul Moment API

서울의 특별한 순간들을 담은 브랜드 소개 API 서비스

## 🏗️ 프로젝트 구조

이 프로젝트는 NestJS 기반의 모노레포 구조로 구성되어 있습니다.

```
seoul-moment-api/
├── apps/
│   ├── api/                     # API 애플리케이션
│   └── batch/                   # 배치 애플리케이션 (크롤링, 메일 등)
├── libs/
│   ├── common/                  # 공통 유틸리티 (로거, 예외처리)
│   ├── config/                  # 환경설정 관리
│   ├── database/                # 데이터베이스 설정
│   ├── cache/                   # Redis 캐시 관리
│   ├── external/                # 외부 API 연동 (Google 등)
│   └── repository/              # 엔티티 및 레포지토리
```

## 🚀 주요 기능

### API 애플리케이션

- **브랜드 관리**: 브랜드 정보, 배너 이미지, 정보 섹션 관리
- **상품 검색**: OpenSearch 기반 고성능 상품 검색 및 필터링
- **뉴스 & 아티클**: 콘텐츠 관리 및 조회, 최신 3개 목록 제공 기능
- **다국어 시스템**: 한국어, 영어, 중국어 지원하는 완전한 multilingual API
- **성능 최적화**: Promise.all 병렬 처리 및 Redis 캐싱 시스템
- **환경별 설정**: local, development, test, production 환경 지원

### Batch 애플리케이션

- **Google Sheets 크롤링**: 외부 데이터 수집 및 동기화
- **메일 서비스**: 자동화된 이메일 발송 기능
- **배치 작업**: 스케줄링된 백그라운드 작업

### 공통 기능

- **로깅**: Winston 기반 구조화된 로깅 및 Morgan HTTP 로깅
- **데이터베이스**: PostgreSQL + TypeORM, UTC 시간 관리

## 🛠️ 설치 및 실행

### 프로젝트 설치

```bash
npm install
```

### 애플리케이션 실행

#### API 서버

```bash
# 로컬 개발 환경 (NODE_ENV=local)
npm run start:local

# 개발 환경 (NODE_ENV=development)
npm run start:dev

# 프로덕션 환경
npm run start:prod

# 디버그 모드
npm run start:debug
```

#### Batch 서버

```bash
# Batch 애플리케이션 실행
npm run start:batch

# Batch 개발 모드
npm run start:batch:dev

# Batch 프로덕션 모드
npm run start:batch:prod
```

## 📊 데이터베이스 스키마

### 브랜드 테이블 구조 (Multilingual System)

```sql
brands                    # 브랜드 기본 정보 (텍스트 필드 제거)
├── brand_banner_images   # 배너 이미지 (1:N, 무제한)
├── brand_sections        # 정보 섹션 (1:N, 무제한) - 텍스트 필드 제거
    └── brand_section_images  # 섹션 이미지 (1:N, 무제한)

languages                 # 언어 관리 (한국어, 영어, 중국어)
├── code: LanguageCode    # 'ko', 'en', 'zh'
├── name: string          # '한국어', 'English', '中文'
├── englishName: string   # 'Korean', 'English', 'Chinese'
└── isActive: boolean     # 활성화 여부

multilingual_texts        # 다국어 텍스트 저장소
├── entityType: string    # 'brand', 'brand_section'
├── entityId: number      # 연결할 엔티티 ID
├── fieldName: string     # 'name', 'description', 'title', 'content'
├── languageId: number    # 언어 ID
└── textContent: string   # 실제 텍스트 내용
```

### 다국어 시스템 특징

- **Generic Design**: 모든 엔티티에 확장 가능한 다국어 텍스트 시스템
- **Type Safety**: LanguageCode enum으로 지원 언어 제한
- **No Fallback**: 요청 언어에 해당하는 데이터만 반환 (fallback 없음)
- **sortOrder 유지**: 관련 엔티티의 정렬 순서 관리
- **CASCADE 삭제**: 데이터 일관성 및 무결성 보장

## 🔍 OpenSearch 인덱스 스키마

### 상품 검색 인덱스 (product-items)

OpenSearch를 활용한 고성능 상품 검색 시스템

#### Index Settings

- **Number of primary shards**: 1
- **Number of replicas**: 0
- **Refresh interval**: 1s

#### Index Mappings

```json
{
  "properties": {
    "id": {
      "type": "keyword"
    },
    "brandId": {
      "type": "long"
    },
    "brandName": {
      "type": "text",
      "fields": {
        "keyword": {
          "type": "keyword",
          "ignore_above": 256
        }
      }
    },
    "categoryId": {
      "type": "long"
    },
    "productCategoryId": {
      "type": "long"
    },
    "optionIdList": {
      "type": "long"
    },
    "productName": {
      "type": "text",
      "fields": {
        "keyword": {
          "type": "keyword",
          "ignore_above": 256
        }
      }
    },
    "colorName": {
      "type": "text",
      "fields": {
        "keyword": {
          "type": "keyword",
          "ignore_above": 256
        }
      }
    },
    "colorCode": {
      "type": "keyword"
    },
    "price": {
      "type": "integer"
    },
    "like": {
      "type": "integer"
    },
    "review": {
      "type": "integer"
    },
    "reviewAverage": {
      "type": "float"
    },
    "image": {
      "type": "keyword",
      "index": false
    },
    "createdAt": {
      "type": "date",
      "format": "strict_date_optional_time||epoch_millis"
    }
  }
}
```

#### 필드 타입 상세 설명

| 필드명              | 타입                     | 설명                    | 특징                                 |
| ------------------- | ------------------------ | ----------------------- | ------------------------------------ |
| `id`                | `keyword`                | 상품 아이템 고유 ID     | 정확한 매칭만 가능, 미래 UUID 대응   |
| `brandId`           | `long`                   | 브랜드 ID (64비트 정수) | 필터링, 집계에 사용                  |
| `brandName`         | `text` + `keyword`       | 브랜드 이름             | 전문 검색(text) + 정렬/집계(keyword) |
| `categoryId`        | `long`                   | 카테고리 ID             | 필터링, 집계에 사용                  |
| `productCategoryId` | `long`                   | 상품 카테고리 ID        | 세부 분류 필터링                     |
| `optionIdList`      | `long`                   | 옵션 ID 배열            | 배열 자동 처리, 특정 옵션 검색       |
| `productName`       | `text` + `keyword`       | 상품 이름               | 전문 검색(text) + 정렬/집계(keyword) |
| `colorName`         | `text` + `keyword`       | 색상 이름               | 전문 검색(text) + 정렬/집계(keyword) |
| `colorCode`         | `keyword`                | 색상 코드 (예: #FF0000) | 정확한 매칭, 필터링                  |
| `price`             | `integer`                | 가격 (32비트 정수)      | 범위 검색, 정렬 가능                 |
| `like`              | `integer`                | 좋아요 수               | 인기도 정렬, 집계                    |
| `review`            | `integer`                | 리뷰 수                 | 신뢰도 정렬, 통계                    |
| `reviewAverage`     | `float`                  | 평점 평균 (소수점)      | 범위 검색(4점 이상), 정렬            |
| `image`             | `keyword` (index: false) | 이미지 URL              | 검색 안 함, 결과 표시용만            |
| `createdAt`         | `date`                   | 생성 날짜               | 시간 범위 검색, 최신순 정렬          |

#### 데이터 타입별 특징

**keyword**

- 정확한 값 매칭 (분석하지 않음)
- 정렬, 필터링, 집계에 최적화
- 사용처: ID, 코드, URL 등

**long**

- 64비트 정수 (-9,223,372,036,854,775,808 ~ 9,223,372,036,854,775,807)
- 숫자 범위 검색, 정렬, 집계 가능
- 사용처: ID, 큰 숫자 값

**integer**

- 32비트 정수 (-2,147,483,648 ~ 2,147,483,647)
- 범위 검색, 정렬, 집계 가능
- 사용처: 가격, 수량, 카운트

**float**

- 32비트 부동소수점
- 소수점 범위 검색, 정렬 가능
- 사용처: 평점, 비율

**text**

- 전문 검색용 (형태소 분석됨)
- 부분 매칭, 유사도 검색 가능
- 사용처: 이름, 설명, 내용

**text + keyword (multi-field)**

- `text`: 전문 검색용
- `keyword`: 정렬/집계용
- 하나의 필드로 두 가지 용도 지원

**date**

- 날짜/시간 데이터
- 범위 검색 (`now-7d` 등), 정렬 가능
- 포맷: ISO 8601 또는 epoch milliseconds

**index: false**

- 검색 인덱스에서 제외
- 디스크 공간 절약, 성능 향상
- 결과 반환 시에만 사용

#### 검색 기능

- **전문 검색**: 브랜드명, 상품명, 색상명 검색 지원
- **다중 필터링**: 브랜드, 카테고리, 옵션별 필터링
- **범위 검색**: 가격, 평점, 등록일 범위 검색
- **정렬**: 가격, 인기도(좋아요), 리뷰수, 평점, 최신순 정렬
- **집계**: 브랜드별, 카테고리별 상품 수 집계

#### 검색 쿼리 예시

**1. 브랜드 필터 + 가격 범위 검색**

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "brandId": 1 } },
        { "range": { "price": { "gte": 100000, "lte": 200000 } } }
      ]
    }
  },
  "sort": [{ "like": { "order": "desc" } }]
}
```

**2. 상품명 검색 + 다중 조건**

```json
{
  "query": {
    "bool": {
      "must": [{ "match": { "productName": "립스틱" } }],
      "filter": [
        { "term": { "categoryId": 2 } },
        { "range": { "reviewAverage": { "gte": 4.0 } } }
      ]
    }
  }
}
```

**3. 최신 상품 조회**

```json
{
  "query": {
    "range": {
      "createdAt": {
        "gte": "now-7d"
      }
    }
  },
  "sort": [{ "createdAt": { "order": "desc" } }]
}
```

## 🔧 개발 히스토리

### 완료된 주요 기능들

#### 인프라 및 아키텍처

- ✅ **모노레포 구조 구축** (apps/api, apps/batch, libs 분리)
- ✅ **환경설정 시스템** (local/dev/test/prod 환경별 설정)
- ✅ **로깅 시스템** (Winston + Morgan, JSON 파싱 로그)
- ✅ **데이터베이스 설정** (PostgreSQL + TypeORM, UTC 시간 처리)
- ✅ **Redis 캐시 시스템** (성능 최적화 및 TLS 보안 연결)
- ✅ **OpenSearch 검색 시스템** (상품 검색 인덱스 설계 및 매핑)

#### 애플리케이션 기능

- ✅ **브랜드 테이블 설계** (Brand, BannerImage, InfoSection, SectionImage)
- ✅ **뉴스 & 아티클 시스템** (News, Article, Section, Image 엔티티 + 최신 목록 기능)
- ✅ **다국어 시스템** (한국어/영어/중국어 지원, Generic Multilingual Entity)
- ✅ **Repository/Service 계층** (데이터 접근 + 비즈니스 로직 분리, Promise.all 최적화)
- ✅ **API 응답 DTO** (Swagger 문서화 + Accept-Language 헤더 지원)
- ✅ **헬스체크 API** (GET /health)
- ✅ **Google Sheets 크롤링** (외부 데이터 수집)
- ✅ **메일 서비스** (자동화된 이메일 발송)

#### 배포 및 운영

- ✅ **ECS 배포 시스템** (API/Batch 분리 배포)
- ✅ **GitHub Actions CI/CD** (dev-batch 파이프라인)
- ✅ **Docker 멀티 스테이지 빌드** (애플리케이션별 최적화)

### API 엔드포인트

```
GET /health                    # 헬스체크
GET /brand/:id                 # 브랜드 소개 페이지 조회 (다국어 지원)
GET /article/:id               # 아티클 조회 (다국어 지원 + 최신 3개 목록)
GET /news/:id                  # 뉴스 조회 (다국어 지원 + 최신 3개 목록)
GET /product                   # 상품 목록 조회 (OpenSearch 기반 검색/필터링)
GET /product/:id               # 상품 상세 조회
```

#### 다국어 API 사용법

```bash
# 브랜드 조회
curl -H "Accept-Language: ko" GET /brand/1      # 한국어
curl -H "Accept-Language: en" GET /brand/1      # 영어
curl -H "Accept-Language: zh" GET /brand/1      # 중국어

# 아티클 조회 (+ 최신 3개 목록 포함)
curl -H "Accept-Language: ko" GET /article/1    # 한국어
curl -H "Accept-Language: en" GET /article/1    # 영어
curl -H "Accept-Language: zh" GET /article/1    # 중국어

# 뉴스 조회 (+ 최신 3개 목록 포함)
curl -H "Accept-Language: ko" GET /news/1       # 한국어
curl -H "Accept-Language: en" GET /news/1       # 영어
curl -H "Accept-Language: zh" GET /news/1       # 중국어
```

#### 상품 검색 API 사용법

```bash
# 상품 목록 조회 (OpenSearch 기반)
curl GET "/product?brandId=1&categoryId=2&page=1&limit=20"

# 가격 범위 필터
curl GET "/product?minPrice=100000&maxPrice=200000"

# 인기순 정렬
curl GET "/product?sortBy=like&sortOrder=desc"

# 복합 조건 검색
curl GET "/product?brandId=1&minPrice=50000&maxPrice=150000&sortBy=reviewAverage&sortOrder=desc"

# 상품 상세 조회
curl -H "Accept-Language: ko" GET /product/1    # 한국어
```

## 🐛 문제 해결

### 환경변수 로딩 이슈

환경변수가 undefined로 나올 때:

1. `.env.{환경}` 파일 확인
2. `ConfigModule.forRoot()` 설정 확인
3. `NODE_ENV` 환경변수 설정 확인

## 📚 기술 스택

- **Framework**: NestJS (API + Batch)
- **Database**: PostgreSQL + TypeORM
- **Search Engine**: OpenSearch (상품 검색 및 필터링)
- **Cache**: Redis (TLS 보안 연결)
- **External APIs**: Google Sheets API, Serper API
- **Logging**: Winston + Morgan
- **Documentation**: Swagger/OpenAPI
- **Code Quality**: ESLint + Prettier
- **Deployment**: AWS ECS + GitHub Actions
- **Containerization**: Docker (멀티 스테이지 빌드)

## 🚀 배포 방법

### Docker Compose 로컬 배포

```bash
# API 서버 빌드 및 배포
NODE_ENV=development docker compose build api
NODE_ENV=development docker compose push api

# Batch 서버 빌드 및 배포
NODE_ENV=development docker compose build batch
NODE_ENV=development docker compose push batch
```

### GitHub Actions 자동 배포

- **dev-batch 브랜치**: Batch 애플리케이션 자동 배포
- **main 브랜치**: API 애플리케이션 자동 배포
- ECS 태스크 정의 분리로 독립적인 배포 관리

배포 테스트
배포 테스트

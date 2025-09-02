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
└── test/                        # 통합 테스트
```

## 🚀 주요 기능

### API 애플리케이션

- **브랜드 관리**: 브랜드 정보, 배너 이미지, 정보 섹션 관리
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
- **통합 테스트**: Docker PostgreSQL을 활용한 실제 DB 테스트

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

## 🧪 테스트

### 단위 테스트

```bash
# 단위 테스트 실행
npm run test

# 단위 테스트 watch 모드
npm run test:watch

# 커버리지 포함 단위 테스트
npm run test:cov
```

### 통합 테스트 (실제 PostgreSQL 사용)

```bash
# 전체 통합 테스트 (추천)
# DB 컨테이너 시작 → 테스트 → 컨테이너 정리
npm run test:full

# 단계별 실행
npm run test:db:up        # PostgreSQL 테스트 컨테이너 시작
npm run test:integration  # 통합 테스트 실행
npm run test:db:down      # 테스트 컨테이너 정리

# 개발 중 유용한 명령어
npm run test:integration:watch  # 통합 테스트 watch 모드
npm run test:db:logs           # 테스트 DB 로그 확인
```

### E2E 테스트

```bash
npm run test:e2e
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

## 🔧 개발 히스토리

### 완료된 주요 기능들

#### 인프라 및 아키텍처

- ✅ **모노레포 구조 구축** (apps/api, apps/batch, libs 분리)
- ✅ **환경설정 시스템** (local/dev/test/prod 환경별 설정)
- ✅ **로깅 시스템** (Winston + Morgan, JSON 파싱 로그)
- ✅ **데이터베이스 설정** (PostgreSQL + TypeORM, UTC 시간 처리)
- ✅ **Redis 캐시 시스템** (성능 최적화 및 TLS 보안 연결)

#### 애플리케이션 기능

- ✅ **브랜드 테이블 설계** (Brand, BannerImage, InfoSection, SectionImage)
- ✅ **뉴스 & 아티클 시스템** (News, Article, Section, Image 엔티티 + 최신 목록 기능)
- ✅ **다국어 시스템** (한국어/영어/중국어 지원, Generic Multilingual Entity)
- ✅ **Repository/Service 계층** (데이터 접근 + 비즈니스 로직 분리, Promise.all 최적화)
- ✅ **API 응답 DTO** (Swagger 문서화 + Accept-Language 헤더 지원)
- ✅ **헬스체크 API** (GET /health)
- ✅ **Google Sheets 크롤링** (외부 데이터 수집)
- ✅ **메일 서비스** (자동화된 이메일 발송)

#### 테스트 및 품질

- ✅ **통합 테스트 환경** (Docker PostgreSQL + 실제 DB 테스트)
- ✅ **완전한 테스트 격리** (외래키 제약조건 비활성화 + TRUNCATE 정리)
- ✅ **100+ 통합 테스트 완료** (Repository/Service/E2E 전 계층, CRUD/다국어/에러처리/동시성)
- ✅ **Article & News 테스트** (각 16개 테스트: Repository 6개 + Service 8개 + E2E 8개)
- ✅ **Redis 캐시 테스트** (캐시 격리 및 성능 테스트)
- ✅ **테스트 환경 안전성** (실제 DB 데이터 보호 장치)

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

## ✅ 테스트 현황

### 통합 테스트 결과

- **총 70개 테스트 모두 통과** ✅
- **다국어 시스템 테스트** 완료 (Language, Multilingual Text, Fallback 로직)
- **완전한 테스트 격리** 구현
- **실제 PostgreSQL + Redis** 사용으로 신뢰할 수 있는 테스트
- **테스트 환경 안전성 검증** (실제 DB 데이터 보호)
- **Cache-only 테스트와 DB+Cache 통합 테스트** 분리

### 테스트 커버리지

```
BrandRepositoryService Integration Tests
├── findAllNormalBrandList (4개 테스트)
│   ├── NORMAL 상태 브랜드만 반환
│   ├── NORMAL 브랜드 없을 때 빈 배열 반환
│   ├── eager loading으로 관련 데이터 포함
│   └── sortOrder에 따른 정렬 검증
├── findBrandById (3개 테스트)
│   ├── 존재하는 NORMAL 브랜드 반환
│   ├── 존재하지 않는 브랜드 시 null 반환
│   └── BLOCK 상태 브랜드 시 null 반환
├── getBrandById (3개 테스트)
│   ├── 존재하는 NORMAL 브랜드 반환
│   ├── 존재하지 않는 브랜드 시 ServiceError 발생
│   └── BLOCK 상태 브랜드 시 ServiceError 발생
└── Database constraints and validation (2개 테스트)
    ├── 동시성 처리 테스트
    └── CASCADE 삭제 무결성 테스트
```

## 🐛 문제 해결

### 환경변수 로딩 이슈

환경변수가 undefined로 나올 때:

1. `.env.{환경}` 파일 확인
2. `ConfigModule.forRoot()` 설정 확인
3. `NODE_ENV` 환경변수 설정 확인

### 테스트 DB 연결 실패

```bash
# Docker 상태 확인
docker ps

# 로그 확인
npm run test:db:logs

# 포트 충돌 시 컨테이너 재시작
npm run test:db:down
npm run test:db:up
```

### 테스트 관련 문제 해결

상세한 테스트 환경 설정 및 문제 해결 가이드는 [CLAUDE.md](./CLAUDE.md)를 참고하세요.

## 📚 기술 스택

- **Framework**: NestJS (API + Batch)
- **Database**: PostgreSQL + TypeORM
- **Cache**: Redis (TLS 보안 연결)
- **External APIs**: Google Sheets API, Serper API
- **Logging**: Winston + Morgan
- **Testing**: Jest + Docker (PostgreSQL + Redis)
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

# Seoul Moment API

서울의 특별한 순간들을 담은 브랜드 소개 API 서비스

## 🚀 주요 기능

### API 애플리케이션

- **브랜드 관리**: 브랜드 정보, 배너 이미지, 정보 섹션 관리
- **다국어 시스템**: 한국어, 영어, 중국어 지원하는 완전한 multilingual API
- **Redis 캐시**: 성능 최적화를 위한 캐싱 시스템
- **환경별 설정**: local, development, test, production 환경 지원

### Batch 애플리케이션

- **Google Sheets 크롤링**: 외부 데이터 수집 및 동기화
- **메일 서비스**: 자동화된 이메일 발송 기능
- **배치 작업**: 스케줄링된 백그라운드 작업

### 공통 기능

- **로깅**: Winston 기반 구조화된 로깅 및 Morgan HTTP 로깅
- **데이터베이스**: PostgreSQL + TypeORM, UTC 시간 관리
- **통합 테스트**: Docker PostgreSQL을 활용한 실제 DB 테스트

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
- ✅ **다국어 시스템** (한국어/영어/중국어 지원, Generic Multilingual Entity)
- ✅ **Repository/Service 계층** (데이터 접근 + 비즈니스 로직 분리)
- ✅ **API 응답 DTO** (Swagger 문서화 + Accept-Language 헤더 지원)
- ✅ **헬스체크 API** (GET /health)
- ✅ **Google Sheets 크롤링** (외부 데이터 수집)
- ✅ **메일 서비스** (자동화된 이메일 발송)

#### 테스트 및 품질

- ✅ **통합 테스트 환경** (Docker PostgreSQL + 실제 DB 테스트)
- ✅ **완전한 테스트 격리** (외래키 제약조건 비활성화 + TRUNCATE 정리)
- ✅ **70개 통합 테스트 완료** (CRUD, 다국어, 에러 처리, 동시성, CASCADE 테스트)
- ✅ **Redis 캐시 테스트** (캐시 격리 및 성능 테스트)
- ✅ **테스트 환경 안전성** (실제 DB 데이터 보호 장치)

#### 배포 및 운영

- ✅ **ECS 배포 시스템** (API/Batch 분리 배포)
- ✅ **GitHub Actions CI/CD** (dev-batch 파이프라인)
- ✅ **Docker 멀티 스테이지 빌드** (애플리케이션별 최적화)

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

## GitHub Actions 자동 배포

- **dev-batch 브랜치**: Batch 애플리케이션 자동 배포
- **dev 브랜치**: API 애플리케이션 자동 배포
- ECS 태스크 정의 분리로 독립적인 배포 관리

# Seoul Moment API

서울의 특별한 순간들을 담은 브랜드 소개 API 서비스

## 🏗️ 프로젝트 구조

이 프로젝트는 NestJS 기반의 모노레포 구조로 구성되어 있습니다.

```
seoul-moment-api/
├── apps/api/                    # API 애플리케이션
├── libs/
│   ├── common/                  # 공통 유틸리티 (로거, 예외처리)
│   ├── config/                  # 환경설정 관리
│   ├── database/                # 데이터베이스 설정
│   └── repository/              # 엔티티 및 레포지토리
└── test/                        # 통합 테스트
```

## 🚀 주요 기능

- **브랜드 관리**: 브랜드 정보, 배너 이미지, 정보 섹션 관리
- **환경별 설정**: local, development, test, production 환경 지원
- **로깅**: Winston 기반 구조화된 로깅 및 Morgan HTTP 로깅
- **데이터베이스**: PostgreSQL + TypeORM, UTC 시간 관리
- **통합 테스트**: Docker PostgreSQL을 활용한 실제 DB 테스트

## 🛠️ 설치 및 실행

### 프로젝트 설치
```bash
npm install
```

### 애플리케이션 실행
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

### 브랜드 테이블 구조
```sql
brands                    # 브랜드 기본 정보
├── brand_banner_images   # 배너 이미지 (1:N, 무제한)
├── brand_info_sections   # 정보 섹션 (1:N, 무제한)
    └── brand_section_images  # 섹션 이미지 (1:N, 무제한)
```

- 모든 관계는 eager loading으로 설정
- sortOrder 필드로 정렬 순서 관리
- CASCADE 삭제로 데이터 일관성 보장

## 🔧 개발 히스토리

### 완료된 주요 기능들
- ✅ **모노레포 구조 구축** (apps/api, libs 분리)
- ✅ **환경설정 시스템** (local/dev/test/prod 환경별 설정)
- ✅ **로깅 시스템** (Winston + Morgan, JSON 파싱 로그)
- ✅ **데이터베이스 설정** (PostgreSQL + TypeORM, UTC 시간 처리)
- ✅ **브랜드 테이블 설계** (Brand, BannerImage, InfoSection, SectionImage)
- ✅ **Repository/Service 계층** (데이터 접근 + 비즈니스 로직 분리)
- ✅ **API 응답 DTO** (Swagger 문서화 포함)
- ✅ **헬스체크 API** (GET /health)
- ✅ **통합 테스트 환경** (Docker PostgreSQL + 실제 DB 테스트)
- ✅ **완전한 테스트 격리** (외래키 제약조건 비활성화 + TRUNCATE 정리)
- ✅ **13개 통합 테스트 완료** (CRUD, 에러 처리, 동시성, CASCADE 테스트)

### API 엔드포인트
```
GET /health                    # 헬스체크
GET /brand/introduce/:id       # 브랜드 소개 페이지 조회
```

## ✅ 테스트 현황

### 통합 테스트 결과
- **총 13개 테스트 모두 통과** ✅
- **완전한 테스트 격리** 구현
- **실제 PostgreSQL** 사용으로 신뢰할 수 있는 테스트

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

- **Framework**: NestJS
- **Database**: PostgreSQL + TypeORM
- **Logging**: Winston + Morgan
- **Testing**: Jest + Docker PostgreSQL
- **Documentation**: Swagger/OpenAPI
- **Code Quality**: ESLint + Prettier

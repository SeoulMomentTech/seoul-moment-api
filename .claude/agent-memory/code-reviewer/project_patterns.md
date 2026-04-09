---
name: Seoul Moment API 코드 패턴
description: NestJS monorepo 프로젝트의 아키텍처, 라이브러리 구조, 코드 컨벤션 정리
type: project
---

## 아키텍처

- NestJS monorepo with two apps: `api` (REST), `batch` (scheduled jobs)
- Shared libraries: @app/database, @app/config, @app/repository, @app/common, etc.
- Path aliases in tsconfig.json for clean imports

## 라이브러리 역할

| Alias | 목적 |
|-------|------|
| @app/repository | Entities (50+), repository services, DTOs |
| @app/common | Exception filters, Winston logger, utilities |
| @app/external | External API clients (AWS S3, Google, OpenAI, etc.) |
| @app/auth | JWT auth, Passport strategies |

## 코드 컨벤션 (반드시 준수)

### 함수 길이
- 최대 50줄 제한 (ESLint max-lines-per-function)
- 함수가 길어지면 헬퍼 메서드로 분리 필수

### Service 계층
- 비즈니스 로직은 Service에만 배치
- Controller는 받은 요청을 Service에 위임만 수행
- @Transactional() 데코레이터 사용 필수 (여러 DB 작업 시)

### DTO 검증
- 모든 DTO 필드에 @ApiProperty / @ApiPropertyOptional 필수
- description과 example 포함 필수
- class-validator 데코레이터 필수 (@IsString, @IsArray, @ValidateNested 등)
- @Type() 데코레이터로 타입 변환 명시

### 에러 처리
- ServiceError 클래스 사용 필수 (raw exceptions 금지)
- 예: `throw new ServiceError('Message', ServiceErrorCode.NOT_FOUND_DATA)`
- 전역 예외 필터 3개로 처리: HttpExceptionFilter, ServiceErrorFilter, InternalExceptionFilter

### 로깅
- console.log 금지 (ESLint no-console: warn)
- console.warn, console.error만 허용
- Winston 구조화된 JSON 로깅 권장

### Import 정렬
- simple-import-sort로 자동 정렬
- unused imports는 에러 처리

## Breaking Change 처리 규칙 (Worktree)

1. 기존 엔드포인트의 request/response 구조 변경 시:
   - 기존 메서드에 @deprecated 추가
   - v1 폴더에 새로운 controller/dto 추가
   - Service에서 v1PostXxx() 메서드로 신규 로직 구현

2. 예시: `/admin/brand` (기존) → `/admin/brand/v1` (새로운)
   - 기존 API: languageId 기반
   - 새 API: languageCode 기반 (더 직관적)

## 다국어 처리

- LanguageRepositoryService로 다국어 텍스트 관리
- EntityType enum으로 엔티티 분류 (BRAND, BRAND_SECTION 등)
- saveMultilingualText(entityType, entityId, fieldName, languageId, content)
- saveMultilingualTextByLanguageCode(entityType, entityId, fieldName, languageCode, content) - 신규

## 이미지 처리

- stripImageDomain() 유틸리티로 S3 도메인 제거
- 저장 전: 도메인 포함된 URL 받음 → stripImageDomain으로 path만 추출
- 도메인은 설정에서 주입됨 (dev/prod별 다른 도메인)

## 테스트

- Integration/E2E 테스트 선호 (mock 대신 실제 DB)
- docker-compose.test.yml로 PostgreSQL(5433) + Redis(6380) 제공
- BDD 패턴: Given-When-Then 주석 필수
- faker-js로 테스트 데이터 생성
- supertest로 HTTP 요청 테스트

## 주의: 파일 범위 제한

- Worktree에서 작업할 때 worktree 폴더 내에서만 파일 수정/생성
- worktree 폴더 외부 파일 수정 = 브랜치 정책 위반

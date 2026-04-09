# Test Writer Agent 지침

변경된 코드에 대한 통합 테스트를 작성/수정하고, 모든 테스트가 통과할 때까지 실행·수정을 반복한다.

## 토큰 절약 규칙

- 테스트 파일 읽을 때 import/describe 블록만 먼저 확인 (전체 X)
- Jest 실행 시 `--silent` + 실패 로그만 grep
- 테스트 파일 참고 시 필요한 파일만 최소한으로 (불필요한 파일 X)
- 재실행은 변경된 파일만 타겟

## 🔴 절대 금지

- **기존 소스 코드(테스트 파일이 아닌 파일)를 절대 수정하거나 덮어쓰지 않는다.**
- 테스트 파일(`test/` 디렉토리)만 생성·수정·삭제할 수 있다.
- 소스 코드에 문제가 있어도 직접 수정하지 말고 리포트에 기록만 한다.

## 실행 순서

1. `git diff HEAD`를 직접 실행하여 변경사항 확인
2. `test/` 디렉토리에서 관련 기존 테스트 파일을 확인하고 구조·import를 참고
3. 기존 테스트 있으면 수정, 없으면 새로 작성
4. `npm run test:db:up`으로 테스트 DB 시작
5. `NODE_ENV=test npx jest --testMatch='**/test/**/*.spec.ts' --runInBand`으로 실행
6. 실패 시 원인 분석 → 수정 → 재실행 (통과까지 반복)

## 테스트 컨벤션

- **BDD 패턴**: `// Given`, `// When`, `// Then` 주석 필수
- **한글 설명**: `it()` 안의 테스트 설명은 한글
- **faker**: 테스트 데이터는 `@faker-js/faker` 사용
- **실제 DB**: mock 없이 PostgreSQL + Redis (docker-compose.test.yml)
- **supertest**: HTTP 요청은 `supertest` 사용
- **인증**: `authHeader(app)` 헬퍼 사용 (`test/setup/auth.helper`)
- **테이블 정리**: `afterEach`에서 `truncateTables(dataSource, [...])` 사용
- **앱 획득**: `getTestApp()` 싱글톤 사용 (`test/setup/test-app`)

## 반환 형식

```
### 실행 결과
- 총 테스트 수 / 통과 수 / 실패 수

### 테스트 변경 내역
- 신규 작성 / 기존 수정 / 삭제 수

### 변경된 테스트 파일
| 파일 | 변경 유형 | 설명 |

### 주요 테스트 케이스
- [케이스 목록]
```

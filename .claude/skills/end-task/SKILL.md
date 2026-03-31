---
name: end-task
description: "작업 완료 후 변경사항에 대한 코드 리뷰와 테스트 코드 작성을 병렬로 수행하는 스킬. 사용자가 '작업 끝', '완료', 'end-task', '테스트 작성해줘', '마무리해줘' 등의 표현을 사용할 때 트리거한다. 코드 변경 후 테스트가 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# End Task: Sub Agent 기반 변경사항 리뷰 및 테스트 자동화

작업이 완료되면 git diff를 분석하여 **코드 리뷰**와 **테스트 작성**을 병렬로 수행하고, 결과를 수합하여 보고한다.

## 구조

```
/end-task (오케스트레이터)
  ├── code-review agent (병렬, 읽기 전용 리포트)
  ├── test-writer agent (병렬, 테스트 작성 + 실행 + 수정)
  └── (결과 수합)
      → 통합 보고 → 커밋 확인 → end-task-jira
```

## 실행 순서

### Step 1: 변경사항 수집

`git diff HEAD`로 현재 변경사항을 확인한다.

```bash
git diff HEAD
```

변경된 파일 목록도 수집한다:

```bash
git diff --name-status HEAD
```

이 diff 내용을 Step 2에서 각 agent에게 전달한다.

### Step 2: Sub Agent 병렬 실행

Agent tool을 사용하여 **단일 메시지에서 두 agent를 병렬로** 실행한다.

#### Agent 1: Code Review Agent

`.claude/skills/end-task/CODE_REVIEW_AGENT.md` 파일을 읽어서 지침을 확인한 뒤, 아래와 같은 prompt로 Agent tool을 호출한다:

```
description: "코드 리뷰 수행"
subagent_type: "code-reviewer"
prompt: |
  이 프로젝트(NestJS monorepo)의 변경사항을 코드 리뷰해주세요.

  ## 중요 규칙
  - 코드를 절대 수정하지 마세요. 읽기 전용 리뷰 리포트만 반환합니다.
  - Read, Grep, Glob 등 읽기 도구만 사용하세요.

  ## 변경된 파일
  {git diff --name-status 결과}

  ## Diff 내용
  {git diff HEAD 결과}

  ## 체크 항목
  1. Breaking Change 여부 (API 필드명/타입/URL 변경)
  2. 보안 취약점 (SQL injection, XSS, 인증 누락)
  3. 타입 안전성 (any 사용, null 처리)
  4. NestJS 패턴 준수 (Controller에 비즈니스 로직 없는지)
  5. 데코레이터 누락 (class-validator, @nestjs/swagger)
  6. 코드 스타일 (함수 50줄 제한, console.log 사용)

  ## 반환 형식
  아래 형식으로 리포트를 반환해주세요:

  ### 변경 파일 분류
  | 파일 | 유형 | 변경 내용 |

  ### 지적사항
  #### 🔴 심각 (반드시 수정)
  #### 🟡 권고 (수정 권장)
  #### 🟢 참고 (선택적)

  ### Breaking Change
  ### 요약
```

#### Agent 2: Test Writer Agent

`.claude/skills/end-task/TEST_WRITER_AGENT.md` 파일을 읽어서 지침을 확인한 뒤, 아래와 같은 prompt로 Agent tool을 호출한다:

```
description: "테스트 작성 및 실행"
subagent_type: "general-purpose"
prompt: |
  이 프로젝트(NestJS monorepo)의 변경사항에 대한 통합 테스트를 작성/수정하고 실행해주세요.

  ## 변경된 파일
  {git diff --name-status 결과}

  ## Diff 내용
  {git diff HEAD 결과}

  ## 테스트 컨벤션
  - BDD 패턴: // Given, // When, // Then 주석 필수
  - 한글 설명: it() 안의 테스트 설명은 한글
  - faker: 테스트 데이터는 @faker-js/faker 사용
  - 실제 DB: mock 없이 PostgreSQL + Redis
  - supertest: HTTP 요청은 supertest 사용
  - 인증: authHeader(app) 헬퍼 사용
  - 테이블 정리: afterEach에서 truncateTables() 사용
  - 기존 테스트 파일 구조와 import를 반드시 참고할 것

  ## 실행 순서
  1. test/ 디렉토리에서 관련 기존 테스트 파일 확인
  2. 기존 테스트 있으면 수정, 없으면 새로 작성
  3. npm run test:db:up 으로 테스트 DB 시작
  4. npm run test:integration 으로 테스트 실행
  5. 실패 시 원인 분석 후 수정, 재실행 (통과할 때까지 반복)

  ## 반환 형식
  ### 실행 결과
  - 총 테스트 수 / 통과 수 / 실패 수
  ### 테스트 변경 내역
  - 신규 작성 / 기존 수정 / 삭제 수
  ### 변경된 테스트 파일
  | 파일 | 변경 유형 | 설명 |
  ### 주요 테스트 케이스 목록
```

### Step 3: 결과 수합 및 통합 보고

두 agent의 결과를 수합하여 사용자에게 다음 형식으로 보고한다:

```
## 작업 완료 보고

### 코드 리뷰 결과
{code-review agent 결과 요약}
- 🔴 심각: N건
- 🟡 권고: N건
- 🟢 참고: N건
- Breaking Change: 있음/없음

### 테스트 결과
{test-writer agent 결과 요약}
- 총 N개 테스트 실행, 통과: N개
- 신규 작성: N개, 기존 수정: N개

### 변경된 파일
| 파일 | 변경 유형 |
|------|-----------|

### 주의사항
- [코드 리뷰에서 발견된 심각/권고 사항]
- [Breaking Change 등]
```

**코드 리뷰에서 🔴 심각 지적이 있는 경우:**

- 해당 내용을 사용자에게 명확히 전달한다.
- 사용자가 수정을 원하면 소스를 수정하고, 테스트를 재실행한다.
- 수정하지 않겠다고 하면 그대로 진행한다.

### Step 4: 커밋 여부 확인

> **테스트가 모두 통과했습니다. 변경사항을 커밋하시겠습니까?**

사용자가 **아니오**라고 하면 여기서 종료한다.

### Step 5: 커밋 메시지 작성

사용자가 **예**라고 하면, 커밋 메시지를 자동 생성한다.

```bash
git diff --name-status HEAD
```

#### 커밋 메시지 포맷

| 변경 성격        | prefix     |
| ---------------- | ---------- |
| 새로운 기능 추가 | `feat`     |
| 버그 수정        | `fix`      |
| 리팩토링         | `refactor` |
| 테스트 추가/수정 | `test`     |
| 문서 변경        | `docs`     |
| 설정/빌드 변경   | `chore`    |

**형식**: `{prefix}: [{티켓 ID}] {변경 내용 요약}`

- 티켓 ID를 모르면 사용자에게 물어본다.
- 변경 내용 요약은 한글로, 한 줄로 간결하게 작성한다.

생성한 메시지를 사용자에게 보여주고 컨펌을 요청한다.

### Step 6: 커밋 실행 및 Jira 연동

사용자가 커밋 메시지를 승인하면:

1. 변경된 파일을 스테이징하고 커밋한다.
2. 커밋 완료 후 **end-task-jira** 스킬을 실행하여 Jira 티켓에 댓글을 추가한다.

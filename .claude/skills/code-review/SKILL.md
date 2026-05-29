---
name: code-review
description: "작업한 변경사항에 대해 코드 리뷰만 수행하는 스킬. 변경 파일이 많으면 서브 에이전트로 병렬 리뷰한다. '코드 리뷰', 'review', '리뷰해줘', '변경사항 확인', '코드 검토' 등의 표현을 사용할 때 트리거한다. 브랜치에서 코드 리뷰가 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# Code Review

브랜치에서 변경된 코드를 리뷰한다. **코드를 절대 수정하지 않는다(Step 5 이후 사용자 승인 항목만 예외).**

## Step 1: 변경사항 수집

```bash
git diff --name-status HEAD
```

변경된 파일 목록을 확인한다.

## Step 2: 리뷰 전략 결정

변경 규모를 보고 병렬/직접을 선택한다.

- **직접 리뷰**: 변경 파일이 3개 이하이고 단일 도메인이면 `git diff HEAD`로 직접 확인 후 Step 3로.
- **병렬 리뷰**: 변경 파일이 많거나(4개 이상) 여러 도메인/모듈에 걸쳐 있으면, 파일을 **도메인·모듈 단위 그룹으로 나눠** 그룹마다 서브 에이전트를 **단일 메시지에서 동시에** 띄운다.
  - `subagent_type: "code-reviewer"`, `model: "haiku"`
  - 각 agent prompt = `.claude/skills/end-task/CODE_REVIEW_AGENT.md` 지침 + **그 그룹의 파일 목록**
  - 각 agent는 `git diff HEAD -- <할당된 파일들>`을 직접 실행하고, 필요 시 Read/Grep/Glob으로 주변 코드 확인
  - 한글 답변 지시

## Step 3: 코드 리뷰 체크 항목

직접 리뷰 시(그리고 서브 에이전트가 따를 기준) 아래 항목을 확인한다.

- **Breaking Change**: API 응답/요청 필드명, 타입, URL 변경 여부, 프론트 영향
- **Breaking Change**: 기존 엔드포인트 `@deprecated` 처리 + v1 폴더 신규 추가 여부
- **보안**: SQL injection, XSS, 인증/인가 누락, 민감 정보 노출
- **타입 안전성**: `any` 사용, null/undefined 처리 누락
- **NestJS 패턴**: Controller에 비즈니스 로직 없는지, `ServiceError` 사용 여부
- **데코레이터**: class-validator, @nestjs/swagger (@ApiProperty에 description/example)
- **Swagger 데코레이터 누락**: DTO 프로퍼티에 @ApiProperty 또는 @ApiPropertyOptional이 빠져 있으면 직접 채워넣는다
- **코드 스타일**: 함수 50줄 제한, console.log 사용, 미사용 import

## Step 4: 리뷰 결과 취합 및 보고

병렬 리뷰였다면 각 에이전트의 결과를 **하나로 취합**한다. 중복 지적은 합치고, 심각도(🔴/🟡/🟢)별로 정렬한다. 아래 형식으로 보고한다.

```
### 변경 파일 분류
| 파일 | 유형 | 변경 내용 |

### 지적사항
#### 🔴 심각 (반드시 수정)
#### 🟡 권고 (수정 권장)
#### 🟢 참고 (선택적)

### Breaking Change
(breaking change가 없으면 "없음"으로 표기)

### 요약
```

## Step 5: 지적사항 수정 여부 확인 (하나씩 질문)

리뷰 결과 보고 후, **지적된 모든 항목을 🔴 심각 → 🟡 권고 → 🟢 참고 순서로 하나씩** `AskUserQuestion`을 사용해 사용자에게 수정 여부를 묻는다.

### 규칙

- 한 번에 하나의 항목만 묻는다. 여러 항목을 묶어서 묻지 않는다.
- 질문 형식은 `[N/총개수] {항목 요약}. 수정할까요?` 형태로 진행 상황을 표시한다.
- 옵션은 기본적으로 두 가지: `수정` / `수정 안 함`. (필요 시 구현 방식 선택지를 추가할 수 있다.)
- 가장 안전하거나 일반적으로 권장되는 선택을 첫 번째 옵션에 두고 `(Recommended)`를 라벨에 붙인다.
- 사용자가 "수정"을 선택한 항목은 `TaskCreate`로 작업 항목을 만들어 추적한다.
- 사용자가 "수정 안 함"을 선택한 항목은 그대로 두고 다음 항목으로 넘어간다.
- 모든 항목에 대한 결정이 끝나면, "수정"으로 결정된 항목들을 작업한다. **서로 다른 파일을 건드리는 독립적인 수정은 서브 에이전트로 병렬 처리**하고, 같은 파일을 건드리는 수정은 순차로 처리한다.
- 작업 시작/완료 시점에 `TaskUpdate`로 상태를 갱신한다.

### 예시 질문 형식

```
🔴 [1/6] PATCH /user/auth/password에 인증/인가가 전혀 없어 누구나 다른 사용자의 비밀번호를 바꿀 수 있습니다. 수정할까요?
- 수정 (Recommended): 이메일 코드 검증 또는 one-time token 가드를 적용
- 수정 안 함: 현재 상태 유지
```

## Step 6: Lint & Prettier

모든 코드 수정 작업이 끝난 후 반드시 실행한다.

```bash
NODE_ENV=local npm run lint
NODE_ENV=local npm run format
```

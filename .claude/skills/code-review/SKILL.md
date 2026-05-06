---
name: code-review
description: "작업한 변경사항에 대해 코드 리뷰만 수행하는 스킬. 서브 에이전트 없이 직접 리뷰한다. '코드 리뷰', 'review', '리뷰해줘', '변경사항 확인', '코드 검토' 등의 표현을 사용할 때 트리거한다. 브랜치에서 코드 리뷰가 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# Code Review

브랜치에서 변경된 코드를 직접 리뷰한다. 서브 에이전트를 사용하지 않고 본인이 직접 수행한다.

## Step 1: 변경사항 수집

```bash
git diff --name-status HEAD
```

변경된 파일 목록을 확인한다.

## Step 2: 상세 diff 확인

```bash
git diff HEAD
```

전체 변경사항의 diff를 직접 확인한다. 필요하면 Read, Grep, Glob으로 주변 코드를 추가로 확인한다.

## Step 3: 코드 리뷰 수행

아래 체크 항목을 기준으로 리뷰한다. **코드를 절대 수정하지 않는다.**

### 체크 항목

- **Breaking Change**: API 응답/요청 필드명, 타입, URL 변경 여부, 프론트 영향
- **Breaking Change**: 기존 엔드포인트 `@deprecated` 처리 + v1 폴더 신규 추가 여부
- **보안**: SQL injection, XSS, 인증/인가 누락, 민감 정보 노출
- **타입 안전성**: `any` 사용, null/undefined 처리 누락
- **NestJS 패턴**: Controller에 비즈니스 로직 없는지, `ServiceError` 사용 여부
- **데코레이터**: class-validator, @nestjs/swagger (@ApiProperty에 description/example)
- **Swagger 데코레이터 누락**: DTO 프로퍼티에 @ApiProperty 또는 @ApiPropertyOptional이 빠져 있으면 직접 채워넣는다
- **코드 스타일**: 함수 50줄 제한, console.log 사용, 미사용 import

## Step 4: 리뷰 결과 보고

아래 형식으로 결과를 보고한다.

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
- 모든 항목에 대한 결정이 끝나면, "수정"으로 결정된 항목들을 순차적으로 작업한다.
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

---
name: worktree-code-review
description: "워크트리에서 작업한 변경사항에 대해 코드 리뷰만 수행하는 스킬. 변경 파일이 많으면 서브 에이전트로 병렬 리뷰한다. '코드 리뷰', 'review', '리뷰해줘', '변경사항 확인', '코드 검토' 등의 표현을 사용할 때 트리거한다. 워크트리 브랜치에서 코드 리뷰가 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# Worktree Code Review

워크트리 브랜치에서 변경된 코드를 리뷰한다. **코드를 절대 수정하지 않는다.**

## 경로 제한

모든 파일 참조(Read, Grep, Glob)는 **현재 워크트리 디렉토리 내부로만** 제한한다. 부모 repo나 워크트리 외부 경로를 절대 참조하지 않는다. **이 제한은 서브 에이전트에게도 prompt로 그대로 전달한다.**

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
  - 각 agent prompt = `.claude/skills/end-task/CODE_REVIEW_AGENT.md` 지침 + **그 그룹의 파일 목록** + **위 "경로 제한" 문구**
  - 각 agent는 `git diff HEAD -- <할당된 파일들>`을 직접 실행하고, 필요 시 워크트리 내부에서만 Read/Grep/Glob으로 주변 코드 확인
  - 한글 답변 지시

## Step 3: 코드 리뷰 체크 항목

직접 리뷰 시(그리고 서브 에이전트가 따를 기준) 아래 항목을 확인한다.

- **Breaking Change**: API 응답/요청 필드명, 타입, URL 변경 여부, 프론트 영향
- **Worktree Breaking Change**: 기존 엔드포인트 `@deprecated` 처리 + v1 폴더 신규 추가 여부
- **Worktree 파일 범위**: 변경 파일이 worktree 폴더 외부에 있으면 🔴
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

🔴 심각 지적이 있으면 사용자에게 명확히 전달하고 수정 여부를 확인한다.

## Step 5: Lint & Prettier

리뷰 완료 후 반드시 실행한다.

```bash
NODE_ENV=local npm run lint
NODE_ENV=local npm run format
```

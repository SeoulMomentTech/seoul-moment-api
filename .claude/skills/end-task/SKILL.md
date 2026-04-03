---
name: end-task
description: "작업 완료 후 변경사항에 대한 코드 리뷰와 테스트 코드 작성을 병렬로 수행하는 스킬. 사용자가 '작업 끝', '완료', 'end-task', '테스트 작성해줘', '마무리해줘' 등의 표현을 사용할 때 트리거한다. 코드 변경 후 테스트가 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# End Task: 변경사항 리뷰 및 테스트 자동화

## Step 1: 변경사항 수집

`git diff --name-status HEAD`로 변경된 파일 목록만 수집한다. full diff는 agent가 직접 실행한다.

## Step 2: Sub Agent 병렬 실행

**단일 메시지에서 두 agent를 병렬로** 실행한다.

### Agent 1: Code Review

- `.claude/skills/end-task/CODE_REVIEW_AGENT.md`를 읽어서 agent prompt의 지침으로 사용
- `subagent_type: "code-reviewer"`, `model: "haiku"`
- prompt에 **변경된 파일 목록**만 전달, diff는 agent가 `git diff HEAD`를 직접 실행
- 한글 답변 지시

### Agent 2: Test Writer

- `.claude/skills/end-task/TEST_WRITER_AGENT.md`를 읽어서 agent prompt의 지침으로 사용
- `subagent_type: "general-purpose"`, `model: "haiku"`
- prompt에 **변경된 파일 목록**만 전달, diff는 agent가 `git diff HEAD`를 직접 실행
- 한글 답변 지시

## Step 3: 결과 수합 및 보고

두 agent의 결과를 수합하여 사용자에게 보고한다.
🔴 심각 지적이 있으면 사용자에게 명확히 전달하고 수정 여부를 확인한다.

## Step 4: Lint & Prettier

테스트 통과 후, 커밋 전에 반드시 실행한다.

```bash
NODE_ENV=local npm run lint
NODE_ENV=local npm run format
```

## Step 5: 커밋

사용자에게 커밋 여부를 확인한다. 승인하면:

1. 커밋 메시지 자동 생성 (feat/fix/refactor/test/docs/chore prefix + 한글 요약)
2. 티켓 ID를 모르면 사용자에게 물어본다
3. 커밋 실행 후 **end-task-jira** 스킬 실행

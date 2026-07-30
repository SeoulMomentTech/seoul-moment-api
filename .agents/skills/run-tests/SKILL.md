---
name: run-tests
description: "테스트 코드를 실행하고 결과를 보고하는 스킬. '테스트 돌려', '테스트 실행', 'run tests', '테스트 결과', '통합 테스트 실행' 등의 표현을 사용할 때 트리거한다. 테스트 작성이 아닌 기존 테스트 실행만 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# Run Tests: 테스트 실행 및 결과 보고

haiku 모델의 단일 agent로 테스트를 실행하고 결과만 간결하게 보고한다.

## 실행

Agent tool로 아래 프롬프트를 실행한다:
- `model: "haiku"`
- `subagent_type: "general-purpose"`

### Agent 프롬프트

```
테스트 실행 전담 agent. 아래 순서대로 실행하고 결과만 보고하라.

1. docker-compose 테스트 DB가 실행 중인지 확인:
   docker-compose -f docker-compose.test.yml ps
   - 실행 중이 아니면: npm run test:db:up && sleep 5

2. 테스트 실행:
   NODE_ENV=test npx jest --selectProjects integration --runInBand

3. 결과를 아래 형식으로 보고:
   - 총 테스트 수 / 통과 / 실패
   - 실패한 테스트가 있으면 파일명과 실패 원인 요약
   - 전체 실행 시간

코드 수정은 절대 하지 않는다. 실행과 보고만 한다.
```

## 결과 전달

agent 결과를 그대로 사용자에게 전달한다. 추가 분석이나 요약은 불필요하다.

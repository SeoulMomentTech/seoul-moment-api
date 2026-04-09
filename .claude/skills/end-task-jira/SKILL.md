---
name: end-task-jira
description: 커밋 후 Jira 티켓에 변경사항 댓글을 자동으로 추가하는 스킬. 커밋 메시지에 Jira 티켓 키(예: [SCRUM-39])가 포함되어 있을 때 트리거한다. 사용자가 '커밋', 'commit', 'end-task-jira', 'jira 업데이트', '지라 댓글', '티켓 업데이트' 등의 표현을 사용하거나, 커밋 메시지에 대괄호로 감싼 Jira 키가 보이면 반드시 이 스킬을 사용해야 한다.
---

# end-task-jira

커밋 완료 후 Jira 티켓에 변경사항을 댓글로 기록하는 스킬.

## 트리거 조건

- 사용자가 커밋을 완료했고, 커밋 메시지에 `[SCRUM-XX]` 형태의 Jira 티켓 키가 포함된 경우
- 사용자가 `/end-task-jira`를 직접 호출한 경우

## 워크플로우

### Step 1: 커밋 메시지에서 Jira 티켓 키 추출

최근 커밋 메시지를 확인하여 대괄호 안의 Jira 티켓 키를 파싱한다.

```bash
git log -1 --pretty=format:"%s"
```

커밋 메시지 예시: `feat: [SCRUM-39] 테스트 완료`
추출할 키: `SCRUM-39`

티켓 키가 없으면 사용자에게 어떤 Jira 티켓과 연결할지 물어본다.

### Step 2: Jira 티켓 정보 조회

`mcp__jira__jira_get`으로 티켓의 제목과 현재 상태를 가져온다:

```
path: /rest/api/3/issue/{ticketKey}
queryParams: {"fields": "summary,status,description"}
jq: "{summary: fields.summary, status: fields.status.name}"
outputFormat: "json"
```

### Step 3: Git 변경사항 수집

최근 커밋의 변경 내용을 수집한다:

```bash
# 변경된 파일 목록
git diff-tree --no-commit-id --name-status -r HEAD

# 변경 내용 요약 (stat)
git diff HEAD~1 --stat

# 상세 diff (댓글 작성 참고용)
git diff HEAD~1
```

### Step 4: Jira 댓글 작성

수집한 정보를 바탕으로 한글 댓글을 작성하여 Jira에 추가한다.

`mcp__jira__jira_post`로 댓글 추가:

```
path: /rest/api/3/issue/{ticketKey}/comment
```

**댓글 형식** (Atlassian Document Format):

댓글은 아래 구조를 따른다. 내용은 반드시 한글로 작성한다.

```
## 커밋: {커밋 메시지}

### 변경 파일
- {파일1}: {변경 유형 - 추가/수정/삭제}
- {파일2}: {변경 유형}
- ...

### 변경 내용 요약
{Jira 티켓 제목과 관련지어 변경 내용을 2-3문장으로 요약}

### 상세 변경사항
- {주요 변경점 1}
- {주요 변경점 2}
- ...
```

Atlassian Document Format (ADF) body 예시:

```json
{
  "body": {
    "type": "doc",
    "version": 1,
    "content": [
      {
        "type": "heading",
        "attrs": {"level": 3},
        "content": [{"type": "text", "text": "커밋: feat: [SCRUM-39] 테스트 완료"}]
      },
      {
        "type": "heading",
        "attrs": {"level": 4},
        "content": [{"type": "text", "text": "변경 파일"}]
      },
      {
        "type": "bulletList",
        "content": [
          {
            "type": "listItem",
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": "src/module/home/home.service.ts: 수정"}]}]
          }
        ]
      },
      {
        "type": "heading",
        "attrs": {"level": 4},
        "content": [{"type": "text", "text": "변경 내용 요약"}]
      },
      {
        "type": "paragraph",
        "content": [{"type": "text", "text": "홈 모듈의 서비스 로직을 개선하여 ..."}]
      }
    ]
  }
}
```

### Step 5: 결과 보고

완료 후 사용자에게 간결하게 보고:

```
Jira [{ticketKey}] "{티켓 제목}" 에 댓글을 추가했습니다.
- 변경 파일: {N}개
- 댓글 내용: {요약 한 줄}
```

## 주의사항

- 댓글 내용은 반드시 **한글**로 작성한다.
- 변경사항 요약 시 단순 파일 나열이 아니라, Jira 티켓 제목과 연관지어 **무엇이 왜 변경되었는지** 설명한다.
- diff가 너무 크면 (20개 파일 이상) 주요 변경 파일만 선별하여 댓글에 포함한다.
- ADF(Atlassian Document Format)를 올바르게 구성해야 Jira에서 서식이 정상 표시된다.

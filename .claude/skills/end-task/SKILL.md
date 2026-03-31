---
name: end-task
description: "작업 완료 후 변경사항에 대한 테스트 코드 작성, 실행, 수정까지 자동으로 수행하는 스킬. 사용자가 '작업 끝', '완료', 'end-task', '테스트 작성해줘', '마무리해줘' 등의 표현을 사용할 때 트리거한다. 코드 변경 후 테스트가 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# End Task: 변경사항 기반 테스트 자동화

작업이 완료되면 git diff를 분석하여 변경된 코드에 대한 통합 테스트를 작성하고, 실행 후 실패가 있으면 수정까지 완료한 뒤 변경 전/후 차이를 보고한다.

## 실행 순서

### Step 1: 변경사항 분석

`git diff`로 현재 변경사항을 확인한다.

```bash
# 스테이징 되지 않은 변경 + 스테이징된 변경 모두 확인
git diff HEAD
```

변경된 파일을 분류한다:
- **Controller** 변경: API 엔드포인트, 요청/응답 구조 변경
- **Service** 변경: 비즈니스 로직 변경
- **DTO** 변경: 필드명, 타입, 유효성 검증 규칙 변경
- **Entity** 변경: DB 스키마, 메서드 변경

테스트 대상은 Controller와 Service 변경이 포함된 모듈이다. DTO나 Entity만 변경된 경우에도 해당 모듈의 Controller를 통해 통합 테스트한다.

### Step 2: 기존 테스트 확인

변경된 모듈에 대한 기존 테스트 파일이 있는지 확인한다.

```bash
# test/ 디렉토리에서 관련 테스트 파일 검색
ls test/*.spec.ts
```

- **기존 테스트 있음**: 변경사항에 맞게 기존 테스트를 수정하고, 필요하면 새 테스트 케이스를 추가한다.
- **기존 테스트 없음**: 새 테스트 파일을 생성한다.

### Step 3: 테스트 코드 작성

이 프로젝트의 테스트 컨벤션을 **반드시** 따른다:

#### 파일 구조
```typescript
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
```

#### 테스트 구조
```typescript
describe('ControllerName (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app); // 인증이 필요한 경우
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, ['관련_테이블명']);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('HTTP_METHOD /endpoint', () => {
    it('한글로 테스트 설명', async () => {
      // Given - 사전 조건 설정

      // When - 테스트 대상 액션
      const res = await request(app.getHttpServer())
        .get('/endpoint')
        .set('Authorization', await authHeader(app));

      // Then - 결과 검증
      expect(res.status).toBe(200);
    });
  });
});
```

#### 작성 원칙

- **BDD 패턴**: `// Given`, `// When`, `// Then` 주석을 반드시 사용한다.
- **한글 설명**: `it()` 안의 테스트 설명은 한글로 작성한다.
- **faker 활용**: 테스트 데이터는 `@faker-js/faker`로 생성한다.
- **실제 DB 사용**: mock 없이 실제 PostgreSQL + Redis에 대해 테스트한다.
- **테이블 정리**: `afterEach`에서 `truncateTables()`로 관련 테이블을 정리한다.
- **supertest 사용**: HTTP 요청은 `supertest`로 수행한다.
- **인증 헬퍼**: 인증이 필요한 엔드포인트는 `authHeader(app)`을 사용한다.

#### 변경 유형별 테스트 전략

**필드명 변경 (예: image → imageUrl)**:
- 새 필드명으로 요청/응답이 정상 동작하는지 검증
- 기존 테스트에서 옛 필드명 참조를 새 필드명으로 업데이트

**비즈니스 로직 변경 (예: 도메인 제거 후 저장)**:
- 입력값이 변환되어 저장되는지 검증 (POST → GET으로 확인)
- edge case 테스트 (null, undefined, 빈 문자열 등)

**유효성 검증 변경**:
- 유효한 입력 → 성공 응답
- 유효하지 않은 입력 → 400 응답
- 경계값 테스트 (MaxLength 등)

**500 방어 테스트**:
- 타입 불일치 (문자열 대신 숫자 등)
- 길이 초과
- 존재하지 않는 리소스 접근

### Step 4: 테스트 실행

```bash
npm run test:integration
```

- 테스트 DB가 실행 중이어야 한다. 실행 중이 아니면 `npm run test:db:up`으로 먼저 시작한다.
- `--runInBand` 플래그가 이미 설정되어 있으므로 별도 지정 불필요.
- 타임아웃은 60초.

### Step 5: 실패 수정

테스트가 실패하면:

1. 에러 메시지를 분석한다.
2. **테스트 코드 문제**인지 **소스 코드 문제**인지 판단한다.
3. 소스 코드 문제라면 소스를 수정한다.
4. 테스트 코드 문제라면 테스트를 수정한다.
5. 다시 테스트를 실행하여 통과를 확인한다.
6. 모든 테스트가 통과할 때까지 반복한다.

### Step 6: 변경 전/후 비교 보고

모든 테스트가 통과하면, 사용자에게 다음 형식으로 보고한다:

```
## 작업 완료 보고

### 변경된 파일
| 파일 | 변경 유형 |
|------|-----------|
| path/to/file.ts | 수정 |

### 변경 전 → 후
- **필드명 변경**: `image` → `imageUrl` (home.dto.ts, admin.home.dto.ts)
- **로직 추가**: 도메인 제거 후 DB 저장 (admin.home.service.ts)

### 테스트 결과
- 총 N개 테스트 실행
- 통과: N개
- 신규 작성: N개
- 기존 수정: N개

### 주의사항
- [Breaking change 등 주의가 필요한 사항]
```

### Step 7: 커밋 여부 확인

테스트 완료 보고 후, 사용자에게 커밋할지 물어본다:

> **테스트가 모두 통과했습니다. 변경사항을 커밋하시겠습니까?**

사용자가 **아니오**라고 하면 여기서 종료한다.

### Step 8: 커밋 메시지 작성

사용자가 **예**라고 하면, 아직 커밋되지 않은 변경 파일들을 분석하여 커밋 메시지를 자동 생성한다.

```bash
# 커밋 대상 파일 확인
git diff --name-status HEAD
```

#### 커밋 메시지 포맷

변경 내용의 성격에 따라 prefix를 결정한다:

| 변경 성격 | prefix | 예시 |
|-----------|--------|------|
| 새로운 기능 추가 | `feat` | `feat: [SCRUM-39] 홈 배너 API 추가` |
| 버그 수정 | `fix` | `fix: [SCRUM-39] 배너 이미지 URL 누락 수정` |
| 리팩토링 (기능 변경 없음) | `refactor` | `refactor: [SCRUM-39] 배너 서비스 로직 정리` |
| 테스트 추가/수정 | `test` | `test: [SCRUM-39] 홈 배너 API 테스트 추가` |
| 문서 변경 | `docs` | `docs: [SCRUM-39] API 문서 업데이트` |
| 설정/빌드 변경 | `chore` | `chore: [SCRUM-39] ESLint 설정 변경` |

**형식**: `{prefix}: [{티켓 ID}] {변경 내용 요약}`

- 티켓 ID는 현재 작업 중인 Jira 티켓을 사용한다. 알 수 없으면 사용자에게 물어본다.
- 변경 내용 요약은 한글로, 한 줄로 간결하게 작성한다.
- 여러 성격의 변경이 섞여 있으면 가장 주된 변경을 기준으로 prefix를 선택한다.

생성한 커밋 메시지를 사용자에게 보여주고 컨펌을 요청한다:

> **커밋 메시지:**
> `feat: [SCRUM-42] 홈 배너 필드명 변경 및 이미지 도메인 처리 추가`
>
> **이 메시지로 커밋하시겠습니까?**

### Step 9: 커밋 실행 및 Jira 연동

사용자가 커밋 메시지를 **승인**하면:

1. 변경된 파일을 스테이징하고 커밋한다.
2. 커밋 완료 후 **end-task-jira** 스킬을 실행하여 Jira 티켓에 댓글을 추가한다.

사용자가 커밋 메시지를 **수정 요청**하면, 수정 후 다시 컨펌을 받는다.

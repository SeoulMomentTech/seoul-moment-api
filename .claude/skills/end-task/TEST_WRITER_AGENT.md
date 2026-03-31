# Test Writer Agent 지침

이 문서는 end-task 스킬에서 Agent tool의 prompt로 사용되는 테스트 작성 지침이다.

## 역할

변경된 코드에 대한 통합 테스트를 작성/수정하고, 실행하여 모든 테스트가 통과할 때까지 수정을 반복한다.

## 실행 순서

### 1. 기존 테스트 확인

변경된 모듈에 대한 기존 테스트 파일이 있는지 확인한다.

```bash
ls test/*.spec.ts
```

- **기존 테스트 있음**: 변경사항에 맞게 기존 테스트를 수정하고, 필요하면 새 테스트 케이스를 추가한다.
- **기존 테스트 없음**: 새 테스트 파일을 생성한다.

### 2. 테스트 코드 작성

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

### 3. 테스트 실행

```bash
# 테스트 DB가 실행 중인지 확인, 아니면 시작
npm run test:db:up

# 통합 테스트 실행
npm run test:integration
```

- `--runInBand` 플래그가 이미 설정되어 있으므로 별도 지정 불필요.
- 타임아웃은 60초.

### 4. 실패 수정 루프

테스트가 실패하면:

1. 에러 메시지를 분석한다.
2. **테스트 코드 문제**인지 **소스 코드 문제**인지 판단한다.
3. 소스 코드 문제라면 소스를 수정한다.
4. 테스트 코드 문제라면 테스트를 수정한다.
5. 다시 테스트를 실행하여 통과를 확인한다.
6. 모든 테스트가 통과할 때까지 반복한다.

## 결과 반환 형식

반드시 아래 형식으로 반환한다:

```
## 테스트 결과

### 실행 결과
- 총 테스트 수: N개
- 통과: N개
- 실패: 0개

### 테스트 변경 내역
- 신규 작성: N개
- 기존 수정: N개
- 삭제: N개

### 변경된 테스트 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| test/xxx.spec.ts | 수정 | 필드명 변경 반영 |

### 주요 테스트 케이스
- [테스트 설명 1]
- [테스트 설명 2]
```

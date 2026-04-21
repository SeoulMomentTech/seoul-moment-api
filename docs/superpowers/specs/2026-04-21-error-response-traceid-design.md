# 에러 응답 traceId 누락 보강 및 prod 메시지 마스킹

## 배경 / 문제

API 서버의 에러 응답은 다음 세 개의 글로벌 `APP_FILTER`로 처리된다
(`apps/api/src/module/api.module.ts:73-82`):

1. `HttpExceptionFilter` — `@Catch(HttpException)`
2. `ServiceErrorFilter` — `@Catch(ServiceError)`
3. `InternalExceptionFilter` — `@Catch(InternalServerErrorException)`

세 필터 모두 응답 바디에 `traceId: this.logger.getTraceId()`를 포함시키고 있다.
하지만 `InternalExceptionFilter`가 `InternalServerErrorException` 인스턴스만
잡도록 선언되어 있어서, 운영에서 주로 터지는 500 케이스가 누락된다:

- `throw new Error(...)`, `TypeError`, `ReferenceError` 등 일반 런타임 에러
- TypeORM `QueryFailedError` (DB 제약 위반, 쿼리 실패 등)
- 외부 API 호출 중 발생한 unhandled Error
- async 경로의 unhandled rejection

이런 예외들은 세 필터 어디에도 매칭되지 않아 NestJS 내장 `BaseExceptionFilter`가
fallback으로 처리한다. 그 응답 포맷은 `{ statusCode, message }`만 포함하며
**traceId가 없어 운영 중 에러를 로그와 교차 확인하기 어렵다.**

추가로, `InternalExceptionFilter`가 `exception.message`를 그대로 응답에
내보내고 있어 — fallback으로 확장하면 DB 쿼리 문자열, 내부 경로, 라이브러리
내부 메시지 등 민감 정보가 그대로 노출될 위험이 생긴다.

## 목표

- 세 필터가 처리하지 못하던 모든 500 케이스도 `traceId`를 포함한 표준 응답으로
  반환.
- `prod` 환경에서는 에러 message를 고정 문자열로 마스킹하여 내부 정보 유출
  방지. 로그에는 원본 메시지/스택을 그대로 남겨 운영자가 traceId로 추적 가능.
- 기존 4xx(HttpException 계열)와 `ServiceError` 응답 포맷은 변화 없음 (회귀 0).

## 변경 사항

### 1. `libs/common/src/exception/internal-exception-filter.ts`

- `@Catch(InternalServerErrorException)` → `@Catch()` (fallback 필터로 전환)
- 사용하지 않게 된 `InternalServerErrorException` import 제거
- `Configuration.getConfig()` + `SupportEnv`를 사용한 환경 분기 추가

**동작 매트릭스**

| NODE_ENV                    | response.message                            | 로그                |
| --------------------------- | ------------------------------------------- | ------------------- |
| `local` / `test` / `dev`    | `exception.message || 'internal service error'` (기존) | 원본 메시지 + 스택 |
| `prod`                      | `'Internal server error'` (고정)            | 원본 메시지 + 스택 |

응답 바디 스키마는 기존과 동일:

```jsonc
{
  "message": "<env 분기 결과>",
  "code": "INTERNAL_SERVER_ERROR",
  "traceId": "<uuid-from-als>"
}
```

### 2. 다른 파일 변경 없음

- `api.module.ts`의 `APP_FILTER` 등록 순서·구성은 그대로.
- `HttpExceptionFilter`, `ServiceErrorFilter`, `LoggerService`는 수정 없음.

## 동작 원리 (왜 이 변경만으로 충분한가)

NestJS는 `APP_FILTER`로 등록된 필터들을 **등록 순서대로** 순회하며
`instanceof metatype` 매칭을 시도한다. 첫 매칭되는 필터가 실행된다.

현재 순서:

1. `HttpExceptionFilter` (HttpException 계열을 먼저 흡수)
2. `ServiceErrorFilter` (ServiceError 흡수)
3. `InternalExceptionFilter`

3번을 `@Catch()`(빈 인자 = 모든 예외 match)로 바꿔도, 위 두 필터가 더 구체적인
매칭으로 먼저 처리하므로 HttpException·ServiceError의 동작은 변하지 않는다.
그 외 모든 예외(일반 Error, DB 에러 등)만 fallback으로 3번이 처리한다.

## 응답 예시

### before

```
// throw new Error('something broke') 내부 발생 시
HTTP/1.1 500 Internal Server Error
{ "statusCode": 500, "message": "Internal server error" }
```

### after (local / dev / test)

```
HTTP/1.1 500 Internal Server Error
{
  "message": "something broke",
  "code": "INTERNAL_SERVER_ERROR",
  "traceId": "a1b2c3d4-..."
}
```

### after (prod)

```
HTTP/1.1 500 Internal Server Error
{
  "message": "Internal server error",
  "code": "INTERNAL_SERVER_ERROR",
  "traceId": "a1b2c3d4-..."
}
```

## 테스트 전략

통합 테스트 기준 (`NODE_ENV=test`, Testcontainers 기반):

1. **fallback 500 케이스 신규 검증**
   - 테스트 전용 컨트롤러/라우트에서 `throw new Error('boom')` 수행.
   - 500 응답 바디에 `message === 'boom'`, `code === 'INTERNAL_SERVER_ERROR'`,
     `traceId`가 uuid 형식인지 검증.

2. **기존 필터 경로 회귀 방지**
   - `NotFoundException` → `HttpExceptionFilter` 포맷 유지 확인.
   - `ServiceError` → `ServiceErrorFilter` 포맷 유지 확인.

3. **prod 메시지 마스킹**
   - `Configuration.getConfig`를 stub/override 하여 `NODE_ENV=prod`로 변환한
     시나리오에서 `throw new Error('sensitive')` → 응답 `message`가
     `'Internal server error'`로 고정, 로그에는 `'sensitive'` 및 스택이
     그대로 남는지 검증.

> prod env stub이 프로젝트 테스트 관행과 충돌하면, 해당 케이스만 단위 테스트
> (필터 단독 호출)로 분리 가능. 구현 계획 단계에서 결정.

## 영향 범위 / 마이그레이션

- 기존 `throw new InternalServerErrorException(...)` 코드는 여전히 3번 필터에
  잡힘 (더 넓은 `@Catch()`로 바뀐 것뿐 — 동일 필터가 계속 처리).
- 응답 바디 스키마 불변 (`message` / `code` / `traceId`).
- 유일한 behavior change: **prod에서 500 응답의 `message`가 고정 문자열로
  바뀜.** 이 필드에 의존하는 클라이언트가 없다는 전제. (어차피 서버 내부
  에러의 message를 사용자에게 그대로 보여주는 것은 UX/보안 안티패턴이므로
  의존했다면 그쪽이 수정 대상.)

## 범위 밖

- 2xx 성공 응답에 traceId 주입 (헤더/바디). 현재 요청 범위 아님.
- `HttpExceptionFilter` / `ServiceErrorFilter` 쪽 메시지 마스킹. 이 둘은
  의도된 비즈니스/검증 에러라 메시지 노출이 안전하다고 간주.
- traceId 생성/전파 경로(`main.ts:77-79` AsyncLocalStorage 미들웨어) 변경.
  현재 동작으로 충분.

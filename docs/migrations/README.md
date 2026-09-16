# 2026-09-15 공동 일정 복구

`2026-09-15-plan-room-scope.sql`은 기존 `/plan/user` 응답의 방 ID 누락으로 공유 이후에도 개인 일정에 남은 방장 데이터를 복구한다.

## 적용

백엔드 수정 코드를 먼저 배포한 뒤 대상 DB에서 아래 파일을 실행한다. SQL에는 트랜잭션이 포함되어 있다.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/migrations/2026-09-15-plan-room-scope.sql
```

- 대상: 본인이 방장인 방이 존재하며 `plan_user_room_id IS NULL`인 일정과 사용자 카테고리.
- 이미 방에 연결된 데이터는 제외한다. 배우자의 개인 일정은 상대방 방으로 이동하지 않는다.
- 삭제·복제 없이 소속 방 ID만 연결한다. 반복 실행 시 이미 처리된 행은 제외된다.
- `test/plan.mobile-collaboration.spec.ts`가 실제 PostgreSQL에서 반복 실행 및 다른 방 데이터 보존을 검증한다.
- 프론트와 백엔드 코드를 수정하는 작업에서는 운영 DB에 실행하지 않았다.

-- 백엔드 수정 배포 후 실행. 방 ID 누락으로 개인 일정에 남은 방장 데이터만 복구한다.
-- 배우자의 개인 일정과 이미 다른 방에 속한 일정/카테고리는 건드리지 않는다.
-- NULL 행만 갱신하므로 반복 실행해도 데이터가 이동하거나 복제되지 않는다.
BEGIN;

UPDATE plan_schedule AS schedule
SET plan_user_room_id = room.id
FROM plan_user_room AS room
WHERE schedule.plan_user_id = room.owner_id
  AND schedule.plan_user_room_id IS NULL;

UPDATE plan_user_category AS category
SET plan_user_room_id = room.id
FROM plan_user_room AS room
WHERE category.plan_user_id = room.owner_id
  AND category.plan_user_room_id IS NULL;

COMMIT;

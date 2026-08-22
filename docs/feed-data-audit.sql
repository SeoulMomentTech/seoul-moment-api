-- 피드(견적 후기) 기획 전제 실측
--
-- 피드의 단위는 "완료된 일정 = 견적 후기" 다. 그 전제가 참인지,
-- 즉 **이미 쌓인 완료 일정이 남에게 보여 줄 만한 값인지**를 먼저 본다.
-- 전부 읽기 전용 집계다. 어떤 행도 바꾸지 않는다.
--
-- 실행: psql "$DATABASE_URL" -f docs/feed-data-audit.sql
--
-- 판단 기준 (이 아래면 작성 흐름을 고쳐야 한다):
--   · 금액 0/한 자리 비율        > 30%  → "금액 피드" 가 성립하지 않는다
--   · 제목이 개인 메모인 비율    > 40%  → 업체명을 따로 물어야 한다
--   · 지역을 못 만드는 비율      > 50%  → 지역 필터를 1차에서 빼야 한다
--   · 후기 10개를 넘길 카테고리  < 3개  → 시세를 말할 수 없다

\echo '=== 0. 전체 규모 ==='
SELECT
  count(*)                                             AS 완료_일정,
  count(DISTINCT plan_user_id)                         AS 사람,
  round(count(*)::numeric / NULLIF(count(DISTINCT plan_user_id), 0), 1) AS 인당_평균
FROM plan_schedule
WHERE status = 'COMPLETED';

\echo ''
\echo '=== 1. 금액이 후기가 될 만한가 ==='
-- amount 는 사용자가 자기 가계부용으로 적은 값이다. 0 이나 한 자리가 많으면
-- 자리만 채운 것이고, 그런 값이 시세로 올라가면 피드 전체가 못 쓰게 된다.
SELECT
  count(*)                                                   AS 전체,
  count(*) FILTER (WHERE amount IS NULL)                      AS 금액_없음,
  count(*) FILTER (WHERE amount = 0)                          AS 금액_0,
  count(*) FILTER (WHERE amount BETWEEN 1 AND 9)              AS 한_자리,
  round(
    100.0 * count(*) FILTER (WHERE amount IS NULL OR amount < 10)
      / NULLIF(count(*), 0), 1
  )                                                           AS "못쓸_비율_%"
FROM plan_schedule
WHERE status = 'COMPLETED';

\echo ''
\echo '--- 금액 분포 (쓸 만한 것만) ---'
SELECT
  count(*)                                                  AS 건수,
  min(amount)                                               AS 최소,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY amount)::int  AS "하위25%",
  percentile_cont(0.50) WITHIN GROUP (ORDER BY amount)::int  AS 중앙값,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY amount)::int  AS "상위25%",
  max(amount)                                               AS 최대
FROM plan_schedule
WHERE status = 'COMPLETED' AND amount >= 10;

\echo ''
\echo '=== 2. 제목이 업체명인가, 개인 메모인가 ==='
-- 제목은 자기가 보려고 적은 메모다. "본식", "1차 미팅", "웨딩홀 상담" 같은
-- 값이 많으면 그대로 올릴 수 없고 업체명을 따로 물어야 한다.
SELECT
  count(*)                                                     AS 전체,
  count(*) FILTER (WHERE char_length(trim(title)) <= 3)          AS "3자_이하",
  count(*) FILTER (
    WHERE title ~ '(상담|미팅|방문|투어|예약|계약|가봉|피팅|본식|촬영|1차|2차|답사|예정|확인)'
  )                                                             AS 메모성_단어,
  count(*) FILTER (WHERE title ~ '^[0-9\s\-\.]+$')               AS 숫자만,
  round(
    100.0 * count(*) FILTER (
      WHERE char_length(trim(title)) <= 3
         OR title ~ '(상담|미팅|방문|투어|예약|계약|가봉|피팅|본식|촬영|1차|2차|답사|예정|확인)'
         OR title ~ '^[0-9\s\-\.]+$'
    ) / NULLIF(count(*), 0), 1
  )                                                             AS "메모_추정_비율_%"
FROM plan_schedule
WHERE status = 'COMPLETED';

\echo ''
\echo '--- 실제 제목 표본 40개 (눈으로 봐야 한다) ---'
SELECT category_name, title, amount
FROM plan_schedule
WHERE status = 'COMPLETED'
ORDER BY random()
LIMIT 40;

\echo ''
\echo '=== 3. 지역을 만들 수 있는가 ==='
-- toRegion() 은 아는 시/도로 시작할 때만 값을 만든다 (아니면 주소 유출).
-- 그 비율이 낮으면 지역 필터를 1차에서 빼는 게 맞다.
SELECT
  count(*)                                            AS 전체,
  count(*) FILTER (WHERE location IS NULL OR trim(location) = '') AS 주소_없음,
  count(*) FILTER (
    WHERE location ~ '^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)'
  )                                                    AS "시도로_시작",
  round(
    100.0 * count(*) FILTER (
      WHERE location ~ '^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)'
    ) / NULLIF(count(*), 0), 1
  )                                                    AS "지역_생성_가능_%"
FROM plan_schedule
WHERE status = 'COMPLETED';

\echo ''
\echo '=== 4. 시세를 말할 수 있는 카테고리 ==='
-- 표본이 적은 카테고리에 평균을 붙이면 그 자체가 거짓 정보다.
-- 10개를 넘는 카테고리가 몇 개인지가 1차 범위를 정한다.
SELECT
  category_name                                             AS 카테고리,
  count(*)                                                  AS 완료_건수,
  count(*) FILTER (WHERE amount >= 10)                       AS 쓸_만한_금액,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY amount)
    FILTER (WHERE amount >= 10)::int                         AS 중앙값,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY amount)
    FILTER (WHERE amount >= 10)::int                         AS "하위25%",
  percentile_cont(0.75) WITHIN GROUP (ORDER BY amount)
    FILTER (WHERE amount >= 10)::int                         AS "상위25%"
FROM plan_schedule
WHERE status = 'COMPLETED'
GROUP BY category_name
ORDER BY count(*) DESC
LIMIT 25;

\echo ''
\echo '=== 5. 한 사람이 피드를 덮을 수 있는가 ==='
-- 상위 몇 명이 완료 일정의 대부분을 갖고 있으면, 그 사람들이 곧 피드다.
-- 어뷰징 이전에 표본 편향 문제다.
WITH per_user AS (
  SELECT plan_user_id, count(*) AS n
  FROM plan_schedule
  WHERE status = 'COMPLETED'
  GROUP BY plan_user_id
)
SELECT
  count(*)                                              AS 사람,
  max(n)                                                AS 최다_보유,
  round(
    100.0 * (SELECT sum(n) FROM (
      SELECT n FROM per_user ORDER BY n DESC LIMIT 5
    ) t) / NULLIF((SELECT sum(n) FROM per_user), 0), 1
  )                                                     AS "상위5명_점유_%"
FROM per_user;

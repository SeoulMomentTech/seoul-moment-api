export enum PlanSchedulePayType {
  CREDIT = 'CREDIT',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

export enum PlanScheduleSortColumn {
  TITLE = 'title',
  AMOUNT = 'amount',
  START_DATE = 'startDate',
  CREATE = 'createDate',
}

export enum PlanScheduleStatus {
  NORMAL = 'NORMAL',
  COMPLETED = 'COMPLETED',
  DELETE = 'DELETE',
}

/**
 * 이 일정의 돈이 나갔는가.
 *
 * **결제와 일정 완료는 다른 축이다.** 미리 낸 계약금은 일정이 예정이어도
 * 이미 쓴 돈이고, 끝났는데 아직 정산 안 한 것은 아직 안 쓴 돈이다.
 *
 * `isPaid` 가 `null` 이면 이 컬럼이 생기기 전에 만들어진 일정이라,
 * 그때 규칙(완료 = 결제)으로 읽는다.
 */
export function isSchedulePaid(schedule: {
  isPaid?: boolean | null;
  status?: PlanScheduleStatus | string | null;
}): boolean {
  if (schedule.isPaid !== null && schedule.isPaid !== undefined) {
    return schedule.isPaid;
  }
  return String(schedule.status) === String(PlanScheduleStatus.COMPLETED);
}

/**
 * 위 규칙의 SQL 판. 집계 쿼리가 이 문자열을 그대로 쓴다 — TS 와 SQL 이
 * 따로 놀면 화면의 숫자와 합계가 어긋난다.
 *
 * `alias` 는 쿼리빌더에서 쓴 테이블 별칭이다.
 */
export function paidSql(alias = 'ps'): string {
  return `COALESCE(${alias}.is_paid, ${alias}.status = '${PlanScheduleStatus.COMPLETED}')`;
}

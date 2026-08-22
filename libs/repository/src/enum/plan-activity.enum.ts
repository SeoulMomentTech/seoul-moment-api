export enum PlanActivityType {
  /** 플랜(일정)을 추가했다 */
  SCHEDULE_CREATED = 'SCHEDULE_CREATED',
  /** 플랜을 완료로 표시했다 */
  SCHEDULE_COMPLETED = 'SCHEDULE_COMPLETED',
  /** 플랜을 삭제했다 */
  SCHEDULE_DELETED = 'SCHEDULE_DELETED',
  /** 총 예산을 바꿨다 */
  BUDGET_UPDATED = 'BUDGET_UPDATED',
  /** 공유 코드로 방에 참여했다 */
  MEMBER_JOINED = 'MEMBER_JOINED',
  /** 방장이 신랑·신부(배우자)를 지정했다 */
  SPOUSE_ASSIGNED = 'SPOUSE_ASSIGNED',
  /** 방장이 배우자 지정을 풀었다 */
  SPOUSE_CLEARED = 'SPOUSE_CLEARED',
  /** 공유 방이 처음 만들어졌다 */
  ROOM_CREATED = 'ROOM_CREATED',
}

export enum PlanActivityTargetType {
  SCHEDULE = 'SCHEDULE',
  ROOM = 'ROOM',
  USER = 'USER',
}

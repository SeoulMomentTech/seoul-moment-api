export enum PlanFeedPostStatus {
  PUBLISHED = 'PUBLISHED',
  /** 운영자가 내린 글. 목록에서 빠지지만 기록은 남는다 */
  HIDDEN = 'HIDDEN',
  DELETE = 'DELETE',
}

/**
 * 후기를 올린 사람이 신랑인지 신부인지.
 *
 * 익명 피드라 이름 대신 이 값과 D-day 로 "D-131 신부" 를 만든다.
 * 안 고르면 UNKNOWN 이고 앱은 "D-131 예비부부" 로 적는다.
 */
export enum PlanFeedAuthorRole {
  GROOM = 'GROOM',
  BRIDE = 'BRIDE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 후기에 대한 평가.
 *
 * 하트가 아니라 **양방향 투표**다. 이 피드의 값어치는 "예쁘다" 가 아니라
 * "쓸모 있다" 에 있고, 하트는 쓸모없는 후기를 아래로 밀어내지 못한다.
 *
 * NOT_HELPFUL 개수는 **바깥에 내보내지 않는다.** 정직하게 올린 후기에
 * "도움이 안 돼요 12" 가 공개로 박히면 다음 사람이 안 올린다 — 공급이
 * 이 기능의 생사다. 정렬과 어뷰징 감지에만 쓴다.
 */
export enum PlanFeedVoteValue {
  HELPFUL = 'HELPFUL',
  NOT_HELPFUL = 'NOT_HELPFUL',
}

export enum PlanFeedSort {
  /** 최신순 */
  RECENT = 'RECENT',
  /** 도움된다는 평가가 많은 순 (안 돼요를 뺀 값) */
  HELPFUL = 'HELPFUL',
  /** 금액 낮은 순 */
  AMOUNT_ASC = 'AMOUNT_ASC',
  /** 금액 높은 순 */
  AMOUNT_DESC = 'AMOUNT_DESC',
}

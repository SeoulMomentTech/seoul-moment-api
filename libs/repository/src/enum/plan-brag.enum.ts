/**
 * 자랑하기 글의 상태.
 *
 * **내릴 때 행을 지우지 않는다.** `published` 를 내리는 대신 상태를
 * UNPUBLISHED 로 바꾼다 — 다시 올렸을 때 좋아요를 이어받을 수 있어야 하고,
 * 지운 뒤에는 그게 소급이 안 된다. 목록·상세에서는 PUBLISHED 만 보인다.
 */
export enum PlanBragStatus {
  PUBLISHED = 'PUBLISHED',
  /** 본인이 내린 상태. 목록에서 빠지고 상세는 404 지만 좋아요는 남아 있다 */
  UNPUBLISHED = 'UNPUBLISHED',
  /** 운영자가 내린 글 */
  HIDDEN = 'HIDDEN',
  DELETE = 'DELETE',
}

export enum PlanBragSort {
  /** 최신순 — 올린 시각 */
  RECENT = 'RECENT',
  /** 좋아요 많은 순 */
  LIKED = 'LIKED',
}

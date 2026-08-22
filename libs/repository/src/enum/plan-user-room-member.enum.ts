export enum PlanUserRoomMemberPermission {
  /** 함께 보는 사람. 대화는 하지만 일정·예산은 못 고친다 */
  READ = 'READ',
  /**
   * 예전 기본값. 지금은 새로 붙지 않지만 이미 이 권한으로 편집하던 사람이
   * 있어 그대로 둔다 — 운영 데이터의 권한을 조용히 뺏지 않는다.
   */
  WRITE = 'WRITE',
  /** 신랑·신부. 방장과 똑같이 플랜을 편집한다. 방마다 한 명뿐이다 */
  SPOUSE = 'SPOUSE',
  OWNER = 'OWNER',
}

// TODO 링크 복사시 방 만들어야함 OWNER 로

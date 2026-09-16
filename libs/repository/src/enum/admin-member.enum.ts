/**
 * 회원 가입 경로 필터.
 *
 * `user` 에 가입 경로 컬럼이 따로 없다. `user_sns` 행이 있으면 그 provider,
 * 없으면 이메일 가입이다. EMAIL 은 그래서 "SNS 연동이 없음"을 뜻한다.
 */
export enum AdminMemberProvider {
  EMAIL = 'EMAIL',
  GOOGLE = 'GOOGLE',
  LINE = 'LINE',
}

/**
 * 회원 상태 필터.
 *
 * 탈퇴는 `user.deleteDate` 소프트 삭제라 기본 조회에서 빠진다.
 * WITHDRAWN 을 명시했을 때만 withDeleted 로 꺼낸다.
 */
export enum AdminMemberStatus {
  ACTIVE = 'ACTIVE',
  WITHDRAWN = 'WITHDRAWN',
}

/** 좋아요 탭에서 섞어 보여주는 두 종류. 테이블이 서로 다르다. */
export enum AdminMemberLikeType {
  PRODUCT = 'PRODUCT',
  BRAND = 'BRAND',
}

export enum JwtType {
  ONE_TIME_TOKEN = 'ONE_TIME_TIME',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  SNS_LINK_TOKEN = 'SNS_LINK_TOKEN',
  SNS_SIGNUP_TOKEN = 'SNS_SIGNUP_TOKEN',
  /** provider가 이메일을 주지 않아 직접 입력받는 동안 sub을 들고 있는 토큰 */
  SNS_EMAIL_TOKEN = 'SNS_EMAIL_TOKEN',
}

/**
 * 토큰을 누구에게 발급했는지 (`aud` 클레임).
 * 관리자·회원 토큰은 같은 시크릿·같은 jwtType·같은 `{ id }` 모양이라,
 * 이 값이 없으면 회원 토큰으로 관리자 API 를 통과할 수 있었다.
 */
export enum JwtAudience {
  ADMIN = 'admin',
  USER = 'user',
}

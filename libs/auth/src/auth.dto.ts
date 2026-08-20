export enum JwtType {
  ONE_TIME_TOKEN = 'ONE_TIME_TIME',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  SNS_LINK_TOKEN = 'SNS_LINK_TOKEN',
  SNS_SIGNUP_TOKEN = 'SNS_SIGNUP_TOKEN',
  /** provider가 이메일을 주지 않아 직접 입력받는 동안 sub을 들고 있는 토큰 */
  SNS_EMAIL_TOKEN = 'SNS_EMAIL_TOKEN',
}

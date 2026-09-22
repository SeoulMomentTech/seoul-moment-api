export enum RedisKey {
  SIGNUP_PHONE = 'signup_phone',
  PASSWORD_PHONE = 'password_phone',
  INFO_PHONE = 'info_phone',
  /** LINE Bot 회원 인증 코드. 키가 lineUserId 라 다른 이메일 인증 흐름과 섞이지 않는다. */
  LINE_BOT_EMAIL = 'line_bot_email',
  /** 심사용 게스트 장바구니. 심사 후 이 키와 모듈을 함께 지운다 */
  GUEST_CART = 'guest_cart',
  USER_RECENT = 'user_recent',
  PRODUCT_LIKE_COUNT = 'product_like_count',
  GOOGLE_SHEET_ID = 'google_sheet_id',
  GOOGLE_SHEET_KEYWORD = 'google_sheet_keyword',
  AI_CONSULT_ANSWER = 'ai_consult_answer',
  AI_CONSULT_RATE = 'ai_consult_rate',
  AI_CONSULT_BUDGET = 'ai_consult_budget',
  /** 상위어("옷")를 실제 소분류 id 로 옮긴 결과. 키에 카탈로그 지문이 섞인다. */
  AI_CONSULT_CATEGORY_RESOLVE = 'ai_consult_category_resolve',
}

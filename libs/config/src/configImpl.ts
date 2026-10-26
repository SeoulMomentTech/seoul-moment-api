import { SupportEnv } from './enum/config.enum';

export interface ConfigImpl {
  // App Config
  NODE_ENV: SupportEnv;
  PORT: number;
  API_VERSION: string;
  IMAGE_DOMAIN_NAME: string;

  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET_NAME: string;

  // Database Config (PostgreSQL)
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USERNAME: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;

  // JWT Config
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // Redis Config (Optional)
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_DB?: number;

  // Google api
  GOOGLE_SHEET_SERVICE_EMAIL: string;
  GOOGLE_SHEET_SERVICE_PRIMARY: string;
  GOOGLE_OAUTH_CLIENT_ID: string;

  // LINE Login (id_token audience = channel ID)
  LINE_CHANNEL_ID: string;
  /** LINE Bot 전용 API 를 부를 때 요구하는 공유 시크릿 */
  LINE_BOT_API_KEY: string;

  SERPER_URL: string;
  SERPER_API_KEY: string;

  RECAPTCHA_SECRET_KEY: string;

  GOOGLE_APP_PASS: string;

  OPENAI_API_KEY: string;

  // Gemini (AI 상담)
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;

  OPENSEARCH_HOST: string;
  OPENSEARCH_NAME: string;
  OPENSEARCH_PASS: string;

  TWSMS_API_URL: string;
  TWSMS_USER: string;
  TWSMS_PASS: string;

  // 결제 — ECPay 통합결제 · LINE Pay
  ECPAY_MERCHANT_ID: string;
  ECPAY_HASH_KEY: string;
  ECPAY_HASH_IV: string;
  /** ECPay 결제 호스트 (payment-stage / payment) */
  ECPAY_PAYMENT_URL: string;
  /** LINE Pay 채널. LINE 로그인 채널(LINE_CHANNEL_ID)과 다르다 */
  LINE_PAY_CHANNEL_ID: string;
  LINE_PAY_CHANNEL_SECRET: string;
  /** LINE Pay API 호스트 (sandbox-api-pay / api-pay) */
  LINE_PAY_API_URL: string;
  /** PG 가 콜백·리다이렉트할 이 API 의 공개 URL (ECPay 는 HTTPS 443 정식 도메인만 받는다) */
  PAYMENT_CALLBACK_BASE_URL: string;
  /** 결제 결과 페이지가 있는 프론트 주소. 비우면 서버가 간단한 결과 페이지를 그린다 */
  STOREFRONT_BASE_URL: string;
  /** 거래번호 접두사 (영문 대문자 2자). 공용 테스트 상점에서 남의 번호와 겹치지 않게 환경마다 다르게 둔다 */
  PAYMENT_TRADE_NO_PREFIX: string;
  // ECPay 전자발표 (B2C). 운영은 결제와 같은 상점·키, 테스트 상점은 결제와 다르다
  ECPAY_INVOICE_MERCHANT_ID: string;
  ECPAY_INVOICE_HASH_KEY: string;
  ECPAY_INVOICE_HASH_IV: string;
  /** 전자발표 호스트 (einvoice-stage / einvoice) */
  ECPAY_INVOICE_URL: string;
  // ECPay 물류 (편의점 픽업). 테스트 상점은 B2C·C2C 가 다르다
  ECPAY_LOGISTICS_MERCHANT_ID: string;
  ECPAY_LOGISTICS_HASH_KEY: string;
  ECPAY_LOGISTICS_HASH_IV: string;
  /** 물류 호스트 (logistics-stage / logistics) */
  ECPAY_LOGISTICS_URL: string;
  /** 'C2C'(店到店, 판매자가 매장에 맡김) 또는 'B2C'(大宗寄倉, 물류센터 납품). 상점 하나는 한쪽만 쓴다 */
  ECPAY_LOGISTICS_TYPE: string;
}

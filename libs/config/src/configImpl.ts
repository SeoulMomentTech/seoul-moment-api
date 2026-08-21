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

  /**
   * Firebase 서비스 계정 키(JSON 원문 또는 base64). FCM 발송 자격증명이다.
   * 비어 있으면 푸시 발송만 비활성화되고 앱은 정상 기동한다.
   */
  FIREBASE_SERVICE_ACCOUNT: string;

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
}

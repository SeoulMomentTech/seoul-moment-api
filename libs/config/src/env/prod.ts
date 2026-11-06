/* eslint-disable max-lines-per-function */
import { ConfigImpl } from '../configImpl';
import { SupportEnv } from '../enum/config.enum';

const getConfig = (): ConfigImpl => ({
  NODE_ENV: SupportEnv.PROD,
  PORT: parseInt(process.env.PORT || '3000'),
  API_VERSION: 'v1',

  IMAGE_DOMAIN_NAME: process.env.IMAGE_DOMAIN_NAME || '',

  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || '',

  DATABASE_HOST: process.env.DATABASE_HOST || '',
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432'),
  DATABASE_USERNAME: process.env.DATABASE_USERNAME || '',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || '',
  DATABASE_NAME: process.env.DATABASE_NAME || '',

  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',

  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_DB: parseInt(process.env.REDIS_DB || '1'),

  GOOGLE_SHEET_SERVICE_EMAIL: process.env.GOOGLE_SHEET_SERVICE_EMAIL || '',
  GOOGLE_SHEET_SERVICE_PRIMARY: process.env.GOOGLE_SHEET_SERVICE_PRIMARY || '',
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '',

  LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID || '',
  LINE_BOT_API_KEY: process.env.LINE_BOT_API_KEY || '',

  SERPER_URL: process.env.SERPER_URL || '',
  SERPER_API_KEY: process.env.SERPER_API_KEY || '',

  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',

  GOOGLE_APP_PASS: process.env.GOOGLE_APP_PASS || '',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',

  OPENSEARCH_HOST: process.env.OPENSEARCH_HOST || '',
  OPENSEARCH_NAME: process.env.OPENSEARCH_NAME || '',
  OPENSEARCH_PASS: process.env.OPENSEARCH_PASS || '',

  TWSMS_API_URL: process.env.TWSMS_API_URL || '',
  TWSMS_USER: process.env.TWSMS_USER || '',
  TWSMS_PASS: process.env.TWSMS_PASS || '',

  ECPAY_MERCHANT_ID: process.env.ECPAY_MERCHANT_ID || '',
  ECPAY_HASH_KEY: process.env.ECPAY_HASH_KEY || '',
  ECPAY_HASH_IV: process.env.ECPAY_HASH_IV || '',
  ECPAY_PAYMENT_URL:
    process.env.ECPAY_PAYMENT_URL || 'https://payment.ecpay.com.tw',
  LINE_PAY_CHANNEL_ID: process.env.LINE_PAY_CHANNEL_ID || '',
  LINE_PAY_CHANNEL_SECRET: process.env.LINE_PAY_CHANNEL_SECRET || '',
  LINE_PAY_API_URL: process.env.LINE_PAY_API_URL || 'https://api-pay.line.me',
  PAYMENT_CALLBACK_BASE_URL:
    process.env.PAYMENT_CALLBACK_BASE_URL || 'https://api.seoulmoment.com.tw',
  STOREFRONT_BASE_URL: process.env.STOREFRONT_BASE_URL || '',
  ALLOW_LOCALHOST_RETURN_URL: false,
  PAYMENT_TRADE_NO_PREFIX: process.env.PAYMENT_TRADE_NO_PREFIX || 'SM',

  ECPAY_INVOICE_MERCHANT_ID:
    process.env.ECPAY_INVOICE_MERCHANT_ID ||
    process.env.ECPAY_MERCHANT_ID ||
    '',
  ECPAY_INVOICE_HASH_KEY:
    process.env.ECPAY_INVOICE_HASH_KEY || process.env.ECPAY_HASH_KEY || '',
  ECPAY_INVOICE_HASH_IV:
    process.env.ECPAY_INVOICE_HASH_IV || process.env.ECPAY_HASH_IV || '',
  ECPAY_INVOICE_URL:
    process.env.ECPAY_INVOICE_URL || 'https://einvoice.ecpay.com.tw',
  ECPAY_LOGISTICS_MERCHANT_ID:
    process.env.ECPAY_LOGISTICS_MERCHANT_ID ||
    process.env.ECPAY_MERCHANT_ID ||
    '',
  ECPAY_LOGISTICS_HASH_KEY:
    process.env.ECPAY_LOGISTICS_HASH_KEY || process.env.ECPAY_HASH_KEY || '',
  ECPAY_LOGISTICS_HASH_IV:
    process.env.ECPAY_LOGISTICS_HASH_IV || process.env.ECPAY_HASH_IV || '',
  ECPAY_LOGISTICS_URL:
    process.env.ECPAY_LOGISTICS_URL || 'https://logistics.ecpay.com.tw',
  ECPAY_LOGISTICS_TYPE: process.env.ECPAY_LOGISTICS_TYPE || 'C2C',
});

export default getConfig;

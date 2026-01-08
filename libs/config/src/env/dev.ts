import { ConfigImpl } from '../configImpl';
import { SupportEnv } from '../enum/config.enum';

const getConfig = (): ConfigImpl => ({
  NODE_ENV: SupportEnv.DEV,
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
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  REDIS_HOST: process.env.REDIS_HOST || '',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_DB: parseInt(process.env.REDIS_DB || '1'),

  GOOGLE_SHEET_SERVICE_EMAIL: process.env.GOOGLE_SHEET_SERVICE_EMAIL || '',
  GOOGLE_SHEET_SERVICE_PRIMARY: process.env.GOOGLE_SHEET_SERVICE_PRIMARY || '',

  SERPER_URL: process.env.SERPER_URL || '',
  SERPER_API_KEY: process.env.SERPER_API_KEY || '',

  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',

  GOOGLE_APP_PASS: process.env.GOOGLE_APP_PASS || '',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  OPENSEARCH_HOST: process.env.OPENSEARCH_HOST || '',
  OPENSEARCH_NAME: process.env.OPENSEARCH_NAME || '',
  OPENSEARCH_PASS: process.env.OPENSEARCH_PASS || '',
});

export default getConfig;

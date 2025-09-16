import { ConfigImpl } from '../configImpl';
import { SupportEnv } from '../enum/config.enum';

const getConfig = (): ConfigImpl => ({
  NODE_ENV: SupportEnv.TEST,
  PORT: 3001,
  API_VERSION: 'v1',

  IMAGE_DOMAIN_NAME: process.env.IMAGE_DOMAIN_NAME || '',

  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || '',

  DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432'),
  DATABASE_USERNAME: process.env.DATABASE_USERNAME || 'postgres',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
  DATABASE_NAME: process.env.DATABASE_NAME || 'seoul_moment_test',

  JWT_SECRET: process.env.JWT_SECRET || 'test_jwt_secret_key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_DB: parseInt(process.env.REDIS_DB || '1'),

  GOOGLE_SHEET_SERVICE_EMAIL: process.env.GOOGLE_SHEET_SERVICE_EMAIL || '',
  GOOGLE_SHEET_SERVICE_PRIMARY: process.env.GOOGLE_SHEET_SERVICE_PRIMARY || '',

  SERPER_URL: process.env.SERPER_URL || '',
  SERPER_API_KEY: process.env.SERPER_API_KEY || '',
});

export default getConfig;

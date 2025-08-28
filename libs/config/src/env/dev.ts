import { ConfigImpl } from '../configImpl';

const config: ConfigImpl = {
  NODE_ENV: 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  API_VERSION: 'v1',

  IMAGE_DOMAIN_NAME: process.env.IMAGE_DOMAIN_NAME || '',

  DATABASE_HOST: process.env.DATABASE_HOST || '',
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432'),
  DATABASE_USERNAME: process.env.DATABASE_USERNAME || '',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || '',
  DATABASE_NAME: process.env.DATABASE_NAME || '',

  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  REDIS_HOST: process.env.REDIS_HOST || '',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),

  GOOGLE_SHEET_SERVICE_EMAIL: process.env.GOOGLE_SHEET_SERVICE_EMAIL || '',
  GOOGLE_SHEET_SERVICE_PRIMARY: process.env.GOOGLE_SHEET_SERVICE_PRIMARY || '',

  SERPER_URL: process.env.SERPER_URL || '',
  SERPER_API_KEY: process.env.SERPER_API_KEY || '',
};

export default config;

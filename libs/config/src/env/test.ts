import { ConfigImpl } from '../configImpl';

const config: ConfigImpl = {
  NODE_ENV: 'test',
  PORT: 3001,
  API_VERSION: 'v1',

  IMAGE_DOMAIN_NAME: process.env.IMAGE_DOMAIN_NAME || '',

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
};

export default config;

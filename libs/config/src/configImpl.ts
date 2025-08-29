import { SupportEnv } from './enum/config.enum';

export interface ConfigImpl {
  // App Config
  NODE_ENV: SupportEnv;
  PORT: number;
  API_VERSION: string;
  IMAGE_DOMAIN_NAME: string;

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

  SERPER_URL: string;
  SERPER_API_KEY: string;
}

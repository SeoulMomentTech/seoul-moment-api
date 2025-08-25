export interface ConfigImpl {
  // App Config
  NODE_ENV: string;
  PORT: number;
  API_VERSION: string;

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
}

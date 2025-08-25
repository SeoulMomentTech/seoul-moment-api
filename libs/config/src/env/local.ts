import { ConfigImpl } from '../configImpl';

const config: ConfigImpl = {
  NODE_ENV: 'local',
  PORT: 3000,
  API_VERSION: 'v1',

  DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432'),
  DATABASE_USERNAME: process.env.DATABASE_USERNAME || 'postgres',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
  DATABASE_NAME: process.env.DATABASE_NAME || 'seoul_moment_local',

  JWT_SECRET: process.env.JWT_SECRET || 'local_jwt_secret_key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),
};

export default config;

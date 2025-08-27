import { ConfigImpl } from '../configImpl';

const config: ConfigImpl = {
  NODE_ENV: 'local',
  PORT: 3000,
  API_VERSION: 'v1',

  IMAGE_DOMAIN_NAME: process.env.IMAGE_DOMAIN_NAME || '',

  DATABASE_HOST: process.env.DATABASE_HOST,
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT),
  DATABASE_USERNAME: process.env.DATABASE_USERNAME,
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  DATABASE_NAME: process.env.DATABASE_NAME,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,

  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: parseInt(process.env.REDIS_PORT),
  REDIS_DB: parseInt(process.env.REDIS_DB),
};

export default config;

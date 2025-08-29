/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction } from 'express';
import helmet from 'helmet';
import moment from 'moment-timezone';
import { v4 as uuidV4 } from 'uuid';

import { BatchModule } from './module/batch.module';

async function bootstrap() {
  const config = Configuration.getConfig();

  moment.tz.setDefault('Asia/Seoul');
  const app = await NestFactory.create<NestExpressApplication>(BatchModule, {
    cors: true,
  });

  const logger = app.get(LoggerService);

  app.use((req: Request, res: Response, next: NextFunction) =>
    logger.scope(uuidV4(), next),
  );

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // 환경 정보 로깅
  logger.info(`🚀 Starting Seoul Moment Batch Server`);
  logger.info(`📦 Environment: ${config.NODE_ENV}`);
  logger.info(`🔧 Port: ${config.PORT}`);
  logger.info(`📊 API Version: ${config.API_VERSION}`);
  logger.info(
    `🗄️  Database: ${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`,
  );

  if (config.REDIS_HOST) {
    logger.info(`🔴 Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
  }

  await app.listen(config.PORT);

  logger.info(`✅ Server is running on http://localhost:${config.PORT}`);
  logger.info(`📚 Environment configuration loaded successfully`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

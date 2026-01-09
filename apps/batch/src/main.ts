/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { LoggerService } from '@app/common/log/logger.service';
import { GoogleSheetService } from '@app/common/module/google-sheet/google-sheet.service';
import { Configuration } from '@app/config/configuration';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction } from 'express';
import helmet from 'helmet';
import moment from 'moment-timezone';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { v4 as uuidV4 } from 'uuid';

import { BatchModule } from './module/batch.module';
import { OpensearchService } from './module/opensearch/opensearch.service';

function scheduleShutdown(
  app: NestExpressApplication,
  logger: LoggerService,
  minutes = 60, // 기본 60분
) {
  const now = moment();
  const shutdownTime = now.clone().add(minutes, 'minutes');
  const msUntilShutdown = shutdownTime.diff(now);

  logger.info(
    `⏰ Scheduled shutdown at: ${shutdownTime.format('YYYY-MM-DD HH:mm:ss')}`,
  );
  logger.info(
    `⏱️  Time until shutdown: ${moment.duration(msUntilShutdown).humanize()}`,
  );

  setTimeout(async () => {
    try {
      logger.info('🛑 Scheduled shutdown initiated...');
      logger.info('📊 Batch processing completed');

      // Graceful shutdown (DB/Redis 등 Nest lifecycle 종료)
      await app.close();
    } finally {
      process.exit(0); // 컨테이너 종료
    }
  }, msUntilShutdown);
}

async function bootstrap() {
  const config = Configuration.getConfig();

  initializeTransactionalContext();

  moment.tz.setDefault('Asia/Seoul');
  const app = await NestFactory.create<NestExpressApplication>(BatchModule, {
    cors: true,
  });

  const logger = app.get(LoggerService);
  const googleSheetService = app.get(GoogleSheetService);
  const opensearchService = app.get(OpensearchService);

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
  logger.info(`📊 API Version: ${config.API_VERSION}`);
  logger.info(
    `🗄️  Database: ${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`,
  );

  if (config.REDIS_HOST) {
    logger.info(`🔴 Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
  }

  logger.info(`📚 Environment configuration loaded successfully`);

  logger.info('❗Start Crawling Batch');
  try {
    logger.info('🔍 Start Google Sheet Service');
    await googleSheetService.progressGoogleSheet();
    logger.info('🔍 Finish Google Sheet Service');
  } catch (error) {
    logger.error('❌ Failed to Google Sheet Service:', error);
  }
  try {
    logger.info('🔍 Start OpenSearch Service');
    await opensearchService.syncProductData();
    logger.info('🔍 Finish OpenSearch Service');
  } catch (error) {
    logger.error('❌ Failed to sync product data:', error);
  }
  logger.info('❗Finish Crawling Batch');

  // 🕐 시작 시점 기준 일정 시간 뒤 종료 (기본 60분)
  scheduleShutdown(app, logger);

  // 종료 시그널 핸들링 (ECS에서 SIGTERM 보냈을 때 대비)
  process.on('SIGTERM', async () => {
    logger.warn('⚠️ SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.warn('⚠️ SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

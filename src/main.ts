import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { Configuration } from '@app/config/configuration';
import { NestExpressApplication } from '@nestjs/platform-express';
import { initializeTransactionalContext } from 'typeorm-transactional';
import moment from 'moment-timezone';
import helmet from 'helmet';

async function bootstrap() {
  // use @Transactional
  initializeTransactionalContext();

  moment.tz.setDefault('Asia/Seoul');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  const logger = new Logger('Bootstrap');
  const config = Configuration.getConfig();

  // 환경 정보 로깅
  logger.log(`🚀 Starting Seoul Moment API Server`);
  logger.log(`📦 Environment: ${config.NODE_ENV}`);
  logger.log(`🔧 Port: ${config.PORT}`);
  logger.log(`📊 API Version: ${config.API_VERSION}`);
  logger.log(
    `🗄️  Database: ${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`,
  );

  if (config.REDIS_HOST) {
    logger.log(`🔴 Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
  }

  await app.listen(config.PORT);

  logger.log(`✅ Server is running on http://localhost:${config.PORT}`);
  logger.log(`📚 Environment configuration loaded successfully`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

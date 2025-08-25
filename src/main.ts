import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { Configuration } from '@app/config/configuration';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const config = Configuration.getConfig();
  
  // 환경 정보 로깅
  logger.log(`🚀 Starting Seoul Moment API Server`);
  logger.log(`📦 Environment: ${config.NODE_ENV}`);
  logger.log(`🔧 Port: ${config.PORT}`);
  logger.log(`📊 API Version: ${config.API_VERSION}`);
  logger.log(`🗄️  Database: ${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`);
  
  if (config.REDIS_HOST) {
    logger.log(`🔴 Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
  }

  const app = await NestFactory.create(AppModule);
  
  await app.listen(config.PORT);
  
  logger.log(`✅ Server is running on http://localhost:${config.PORT}`);
  logger.log(`📚 Environment configuration loaded successfully`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

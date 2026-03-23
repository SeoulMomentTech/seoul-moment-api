/* eslint-disable max-lines-per-function */
import { swaggerSettring } from '@app/common/docs/swagger';
import { LoggerService } from '@app/common/log/logger.service';
import morganSetting from '@app/common/log/morgan';
import { Configuration } from '@app/config/configuration';
import { RedisIoAdapter } from '@app/socket/redis.adapter';
import {
  BadRequestException,
  HttpStatus,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import bodyParser from 'body-parser';
import { NextFunction } from 'express';
import helmet from 'helmet';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { v4 as uuidV4 } from 'uuid';

import { AdminModule } from './module/admin/admin.module';
import { AdminArticleModule } from './module/admin/article/admin.article.module';
import { AdminAuthModule } from './module/admin/auth/admin.auth.module';
import { AdminBrandModule } from './module/admin/brand/admin.brand.module';
import { AdminBrandPromotionModule } from './module/admin/brand/promotion/admin.brand.promotion.module';
import { AdminBrandPromotionBannerModule } from './module/admin/brand/promotion/banner/admin.brand.promotion.banner.module';
import { AdminBrandPromotionEventModule } from './module/admin/brand/promotion/event/admin.brand.promotion.event.module';
import { AdminBrandPromotionNoticeModule } from './module/admin/brand/promotion/notice/admin.brand.promotion.notice.module';
import { AdminBrandPromotionPopupModule } from './module/admin/brand/promotion/popup/admin.brand.promotion.popup.module';
import { AdminBrandPromotionSectionModule } from './module/admin/brand/promotion/section/admin.brand.promotion.section.module';
import { AdminCategoryModule } from './module/admin/category/admin.category.module';
import { AdminHomeModule } from './module/admin/home/admin.home.module';
import { AdminImageModule } from './module/admin/image/admin.image.module';
import { AdminNewsModule } from './module/admin/news/admin.news.module';
import { AdminProductModule } from './module/admin/product/admin.product.module';
import { AdminPromotionModule } from './module/admin/promotion/admin.promotion.module';
import { AdminUserModule } from './module/admin/user/admin.user.module';
import { AppModule } from './module/api.module';
import { ArticleModule } from './module/article/article.module';
import { AuthModule } from './module/auth/auth.module';
import { BrandModule } from './module/brand/brand.module';
import { BrandPromotionModule } from './module/brand/promotion/brand.promotion.module';
import { CategoryModule } from './module/category/category.module';
import { GoogleModule } from './module/google/google.module';
import { HomeModule } from './module/home/home.module';
import { LanguageModule } from './module/language/language.module';
import { NewsModule } from './module/news/news.module';
import { PartnerModule } from './module/partner/partner.module';
import { PlanAuthModule } from './module/plen/auth/plan.auth.module';
import { PlanCategoryModule } from './module/plen/category/plan-category.module';
import { ChatModule } from './module/plen/chat/chat.module';
import { PlanModule } from './module/plen/plan.module';
import { PlanRoomModule } from './module/plen/room/plan-room.module';
import { PlanScheduleModule } from './module/plen/schedule/plan-schedule.module';
import { PlanSettingModule } from './module/plen/setting/plan-setting.module';
import { PlanUserModule } from './module/plen/user/plan.user.module';
import { ProductModule } from './module/product/product.module';

async function bootstrap() {
  const config = Configuration.getConfig();

  initializeTransactionalContext();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });

  const logger = app.get(LoggerService);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) =>
    logger.scope(uuidV4(), next),
  );

  morganSetting(app);
  swaggerSettring(app, {
    docsInclude: [
      AppModule,
      AdminModule,
      AdminHomeModule,
      AdminCategoryModule,
      AdminBrandModule,
      AdminImageModule,
      AdminAuthModule,
      AdminNewsModule,
      AdminArticleModule,
      AdminProductModule,
      AdminUserModule,
      AdminPromotionModule,
      AdminBrandPromotionModule,
      AdminBrandPromotionSectionModule,
      AdminBrandPromotionBannerModule,
      AdminBrandPromotionNoticeModule,
      AdminBrandPromotionPopupModule,
      AdminBrandPromotionEventModule,
      ArticleModule,
      AuthModule,
      BrandModule,
      BrandPromotionModule,
      CategoryModule,
      GoogleModule,
      HomeModule,
      LanguageModule,
      NewsModule,
      PartnerModule,
      ProductModule,
    ], // /docs, /docs-json에만 노출 (Plen 제외)
    plenInclude: [
      PlanModule,
      PlanAuthModule,
      PlanSettingModule,
      PlanUserModule,
      PlanScheduleModule,
      PlanCategoryModule,
      PlanRoomModule,
      ChatModule,
    ], // 이 모듈에 속한 컨트롤러만 /docs-plen, /docs-plen-json에 표시
  });

  app.use(bodyParser.json({ limit: '100mb' }));
  app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
  app.use(bodyParser.text({ limit: '100mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      disableErrorMessages: false,
      validationError: {
        target: true,
        value: true,
      },
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );

  // 환경 정보 로깅
  logger.info(`🚀 Starting Seoul Moment API Server`);
  logger.info(`📦 Environment: ${config.NODE_ENV}`);
  logger.info(`🔧 Port: ${config.PORT}`);
  logger.info(`📊 API Version: ${config.API_VERSION}`);
  logger.info(
    `🗄️  Database: ${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`,
  );

  if (config.REDIS_HOST) {
    logger.info(`🔴 Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
  }

  // Redis adapter 사용 시 연결 실패/재연결 반복 시 CPU 80% 폭주. 인스턴스 2개 이상일 때만 켜기.
  if (config.REDIS_HOST) {
    logger.info('[main] WebSocket: using Redis adapter (multi-instance)');
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  } else {
    logger.info(
      '[main] WebSocket: using in-memory adapter (single instance, no Redis Socket.IO)',
    );
  }

  await app.listen(config.PORT);

  logger.info(`✅ Server is running on http://localhost:${config.PORT}`);
  logger.info(`📚 Environment configuration loaded successfully`);
  logger.info('JWT_SECRET: ' + config.JWT_SECRET);
  logger.info('JWT_EXPIRES_IN: ' + config.JWT_EXPIRES_IN);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

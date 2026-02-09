/* eslint-disable max-lines-per-function */
import { swaggerSettring } from '@app/common/docs/swagger';
import { LoggerService } from '@app/common/log/logger.service';
import morganSetting from '@app/common/log/morgan';
import { Configuration } from '@app/config/configuration';
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
import moment from 'moment-timezone';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { v4 as uuidV4 } from 'uuid';

import { AppModule } from './module/api.module';
import { PlanAuthModule } from './module/plen/auth/plan.auth.module';
import { PlanCategoryModule } from './module/plen/category/plan-category.module';
import { PlanModule } from './module/plen/plan.module';
import { PlanRoomModule } from './module/plen/room/plan-room.module';
import { PlanScheduleModule } from './module/plen/schedule/plan-schedule.module';
import { PlanSettingModule } from './module/plen/setting/plan-setting.module';
import { PlanUserModule } from './module/plen/user/plan.user.module';

async function bootstrap() {
  const config = Configuration.getConfig();

  initializeTransactionalContext();

  moment.tz.setDefault('Asia/Seoul');
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
    plenInclude: [
      PlanModule,
      PlanAuthModule,
      PlanSettingModule,
      PlanUserModule,
      PlanScheduleModule,
      PlanCategoryModule,
      PlanRoomModule,
    ], // 이 모듈에 속한 컨트롤러만 /docs-plen에 표시
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

  await app.listen(config.PORT);

  logger.info(`✅ Server is running on http://localhost:${config.PORT}`);
  logger.info(`📚 Environment configuration loaded successfully`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

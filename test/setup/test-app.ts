import {
  BadRequestException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { initializeTransactionalContext } from 'typeorm-transactional';

import { AppModule } from '../../apps/api/src/module/api.module';

let app: INestApplication | null = null;
let transactionalContextInitialized = false;

/**
 * 테스트 전체에서 NestJS 앱을 1회만 부트스트랩하는 싱글톤 팩토리.
 * --runInBand 전제 하에 모든 spec 파일이 동일한 인스턴스를 공유한다.
 */
export async function getTestApp(): Promise<INestApplication> {
  if (app) return app;

  if (!transactionalContextInitialized) {
    initializeTransactionalContext();
    transactionalContextInitialized = true;
  }

  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    logger: false, // 테스트 실행 중 불필요한 로그 억제 → 속도 향상
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      disableErrorMessages: false,
      validationError: { target: true, value: true },
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );

  await app.init();

  return app;
}

/**
 * 모든 테스트가 완료된 후 앱을 종료한다.
 * 마지막 spec 파일의 afterAll에서 한 번만 호출한다.
 */
export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
}

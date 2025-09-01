import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { InternalExceptionFilter } from '@app/common/exception/internal-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerModule } from '@app/common/log/logger.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { HealthController } from '../health.controller';
import { GoogleModule } from './google/google.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
    }),
    LoggerModule,
    GoogleModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ServiceErrorFilter,
    },
    {
      provide: APP_FILTER,
      useClass: InternalExceptionFilter,
    },
  ],
})
export class BatchModule {}

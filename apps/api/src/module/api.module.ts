import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from '@app/database/database.service';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '@app/common/log/logger.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { HealthController } from '../health.controller';
import { BrandModule } from './brand/brand.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { InternalExceptionFilter } from '@app/common/exception/internal-exception-filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
    }),
    TypeOrmModule.forRootAsync({
      imports: [DatabaseModule],
      useClass: DatabaseService,
      inject: [DatabaseService],
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid options passed');
        }

        return addTransactionalDataSource(new DataSource(options));
      },
    }),
    LoggerModule,
    RepositoryModule,
    BrandModule,
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
export class AppModule {}

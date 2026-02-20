import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { InternalExceptionFilter } from '@app/common/exception/internal-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerModule } from '@app/common/log/logger.module';
import { DatabaseModule } from '@app/database/database.module';
import { DatabaseService } from '@app/database/database.service';
import { RepositoryModule } from '@app/repository/repository.module';
import { SocketModule } from '@app/socket/socket.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

import { HealthController } from '../health.controller';
import { AdminModule } from './admin/admin.module';
import { ArticleModule } from './article/article.module';
import { AuthModule } from './auth/auth.module';
import { BrandModule } from './brand/brand.module';
import { CategoryModule } from './category/category.module';
import { GoogleModule } from './google/google.module';
import { HomeModule } from './home/home.module';
import { LanguageModule } from './language/language.module';
import { NewsModule } from './news/news.module';
import { PartnerModule } from './partner/partner.module';
import { PlanModule } from './plen/plan.module';
import { ProductModule } from './product/product.module';

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
    AdminModule,
    BrandModule,
    GoogleModule,
    NewsModule,
    ArticleModule,
    HomeModule,
    ProductModule,
    CategoryModule,
    PartnerModule,
    PlanModule,
    LanguageModule,
    AuthModule,
    SocketModule,
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

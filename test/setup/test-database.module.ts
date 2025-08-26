import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-info-section.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { LoggerModule } from '@app/common/log/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.test',
      isGlobal: true,
    }),
    LoggerModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5433'),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [
        BrandEntity,
        BrandBannerImageEntity,
        BrandSectionEntity,
        BrandSectionImageEntity,
      ],
      synchronize: true, // 테스트용으로만 true 사용
      dropSchema: false, // 스키마를 유지하고 데이터만 정리
      logging: false, // 테스트 시 로깅 비활성화
    }),
    TypeOrmModule.forFeature([
      BrandEntity,
      BrandBannerImageEntity,
      BrandSectionEntity,
      BrandSectionImageEntity,
    ]),
  ],
  exports: [TypeOrmModule, LoggerModule],
})
export class TestDatabaseModule {}
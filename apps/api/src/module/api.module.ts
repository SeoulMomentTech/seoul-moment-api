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
  ],
  controllers: [HealthController],
})
export class AppModule {}

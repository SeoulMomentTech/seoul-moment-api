import { LoggerModule } from '@app/common/log/logger.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.test',
      isGlobal: true,
    }),
    LoggerModule,
  ],
  exports: [ConfigModule, LoggerModule],
})
export class TestBaseModule {}
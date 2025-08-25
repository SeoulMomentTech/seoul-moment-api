import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 전역 모듈화 (다른 모듈에서도 바로 사용 가능)
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`, // 환경별 .env 파일 로드
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}

import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlanActivityController } from './plan-activity.controller';
import { PlanActivityService } from './plan-activity.service';

@Module({
  imports: [
    RepositoryModule,
    KakaoModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [PlanActivityController],
  providers: [PlanActivityService],
  // 스케줄·방·설정 서비스가 활동을 남길 때 쓴다
  exports: [PlanActivityService],
})
export class PlanActivityModule {}

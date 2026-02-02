import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlanScheduleController } from './plan-schedule.controller';
import { PlanScheduleService } from './plan-schedule.service';

@Module({
  imports: [
    RepositoryModule,
    KakaoModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [PlanScheduleController],
  providers: [PlanScheduleService],
})
export class PlanScheduleModule {}

import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlanSettingController } from './plan-setting.controller';
import { PlanSettingService } from './plan-setting.service';

@Module({
  imports: [
    RepositoryModule,
    KakaoModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [PlanSettingController],
  providers: [PlanSettingService],
})
export class PlanSettingModule {}

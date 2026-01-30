import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { PlanAuthController } from './plan.auth.controller';
import { PlanAuthService } from './plan.auth.service';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
    KakaoModule,
  ],
  controllers: [PlanAuthController],
  providers: [PlanAuthService],
})
export class PlanAuthModule {}

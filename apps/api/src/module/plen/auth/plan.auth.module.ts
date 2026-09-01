import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlanAuthController } from './plan.auth.controller';
import { PlanAuthService } from './plan.auth.service';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
    KakaoModule,
    // logout/all 에 걸린 PlanApiGuard 가 JwtService 를 직접 주입받는다.
    // CommonAuthModule 은 JwtModule 을 내보내지 않아 따로 등록해야 한다.
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [PlanAuthController],
  providers: [PlanAuthService],
})
export class PlanAuthModule {}

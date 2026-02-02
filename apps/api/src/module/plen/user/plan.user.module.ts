import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlanUserController } from './plan-user.controller';
import { PlanUserService } from './plan-user.service';

@Module({
  imports: [
    RepositoryModule,
    KakaoModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [PlanUserController],
  providers: [PlanUserService],
})
export class PlanUserModule {}

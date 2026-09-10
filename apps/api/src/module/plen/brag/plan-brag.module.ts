import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlanBragController } from './plan-brag.controller';
import { PlanBragService } from './plan-brag.service';

@Module({
  imports: [
    RepositoryModule,
    KakaoModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [PlanBragController],
  providers: [PlanBragService],
  exports: [PlanBragService],
})
export class PlanBragModule {}

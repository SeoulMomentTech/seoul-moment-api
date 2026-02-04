import { Configuration } from '@app/config/configuration';
import { KakaoModule } from '@app/external/kakao/kakao.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlanCategoryController } from './plan-category.controller';
import { PlanCategoryService } from './plan-category.service';

@Module({
  imports: [
    RepositoryModule,
    KakaoModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [PlanCategoryController],
  providers: [PlanCategoryService],
})
export class PlanCategoryModule {}

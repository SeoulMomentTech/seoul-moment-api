import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BrandPromotionController } from './brand.promotion.controller';
import { BrandPromotionService } from './brand.promotion.service';
import { V1BrandPromotionController } from './v1/v1.brand.promotion.controller';
import { OptionalUserGuard } from '../../../guard/optional-user.guard';

@Module({
  imports: [
    RepositoryModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [BrandPromotionController, V1BrandPromotionController],
  providers: [BrandPromotionService, OptionalUserGuard],
})
export class BrandPromotionModule {}

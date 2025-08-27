import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';

@Module({
  imports: [RepositoryModule],
  controllers: [BrandController],
  providers: [BrandService],
})
export class BrandModule {}

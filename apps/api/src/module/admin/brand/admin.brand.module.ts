import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandController } from './admin.brand.controller';
import { AdminBrandService } from './admin.brand.service';
import { V1AdminBrandController } from './v1/v1.admin.brand.controller';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandController, V1AdminBrandController],
  providers: [AdminBrandService],
  exports: [AdminBrandService],
})
export class AdminBrandModule {}

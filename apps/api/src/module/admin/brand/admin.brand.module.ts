import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandController } from './admin.brand.controller';
import { AdminBrandService } from './admin.brand.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandController],
  providers: [AdminBrandService],
  exports: [AdminBrandService],
})
export class AdminBrandModule {}

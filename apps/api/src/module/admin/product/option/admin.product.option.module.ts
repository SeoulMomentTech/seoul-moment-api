import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminProductOptionController } from './admin.product.option.controller';
import { AdminProductOptionService } from './admin.product.option.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminProductOptionController],
  providers: [AdminProductOptionService],
})
export class AdminProductOptionModule {}

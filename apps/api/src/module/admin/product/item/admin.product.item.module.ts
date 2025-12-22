import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminProductItemController } from './admin.product.item.controller';
import { AdminProductItemService } from './admin.product.item.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminProductItemController],
  providers: [AdminProductItemService],
})
export class AdminProductItemModule {}

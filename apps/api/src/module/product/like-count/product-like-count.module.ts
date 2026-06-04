import { CacheModule } from '@app/cache/cache.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { ProductLikeCountService } from './product-like-count.service';

@Module({
  imports: [RepositoryModule, CacheModule],
  providers: [ProductLikeCountService],
  exports: [ProductLikeCountService],
})
export class ProductLikeCountModule {}

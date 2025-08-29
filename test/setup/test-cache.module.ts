import { CacheModule } from '@app/cache/cache.module';
import { Module } from '@nestjs/common';

import { TestBaseModule } from './test-base.module';

@Module({
  imports: [
    TestBaseModule,
    CacheModule,
  ],
  exports: [TestBaseModule, CacheModule],
})
export class TestCacheModule {}
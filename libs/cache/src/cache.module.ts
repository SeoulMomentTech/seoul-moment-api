import { RedisModule } from '@liaoliaots/nestjs-redis';
import { Module } from '@nestjs/common';

import { CacheService } from './cache.service';
import { RedisFactory } from './redis.factory';

@Module({
  imports: [
    RedisModule.forRootAsync({
      useClass: RedisFactory,
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}

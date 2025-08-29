import { Configuration } from '@app/config/configuration';
import {
  RedisModuleOptions,
  RedisOptionsFactory,
} from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisFactory implements RedisOptionsFactory {
  async createRedisOptions(): Promise<RedisModuleOptions> {
    return {
      config: {
        host: Configuration.getConfig().REDIS_HOST,
        db: Configuration.getConfig().REDIS_DB,
        port: Configuration.getConfig().REDIS_PORT,
      },
    };
  }
}

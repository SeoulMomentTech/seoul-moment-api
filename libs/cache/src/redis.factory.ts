import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import {
  RedisModuleOptions,
  RedisOptionsFactory,
} from '@liaoliaots/nestjs-redis';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RedisFactory implements RedisOptionsFactory {
  private readonly logger = new Logger(RedisFactory.name);

  async createRedisOptions(): Promise<RedisModuleOptions> {
    const config = Configuration.getConfig();
    const useTls =
      config.NODE_ENV === SupportEnv.DEV ||
      config.NODE_ENV === SupportEnv.PROD;

    this.logger.log(
      `🔴 [Redis] 연결 시도: ${config.REDIS_HOST}:${config.REDIS_PORT ?? 6379} (DB: ${config.REDIS_DB ?? 0}, TLS: ${useTls})`,
    );

    return {
      config: {
        host: config.REDIS_HOST,
        db: config.REDIS_DB,
        port: config.REDIS_PORT,
        ...(useTls ? { tls: {} } : {}),
      },
    };
  }
}

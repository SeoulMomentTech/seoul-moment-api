import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(private readonly redisService: RedisService) {
    this.client = redisService.getOrThrow();
  }

  async onModuleInit() {
    try {
      const info = await this.client.info('server');
      const versionMatch = info.match(/redis_version:(\S+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      this.logger.log(`✅ [Redis] 연결 성공 (version: ${version})`);
    } catch (error) {
      this.logger.error(`❌ [Redis] 연결 실패: ${error.message}`);
    }
  }

  async get(key: string): Promise<string> {
    const result = await this.client.get(key);

    if (!result)
      throw new ServiceError(
        `No content found for the key: "${key}"`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return result;
  }

  async find(key: string): Promise<string | null> {
    const result = await this.client.get(key);

    return result;
  }

  async set(key: string, value: string | Buffer | number, expireTime?: number) {
    if (expireTime) {
      const result = await this.client.set(key, value, 'EX', expireTime);

      return result;
    }

    const result = await this.client.set(key, value);

    return result;
  }

  async incr(key: string) {
    await this.client.incr(key);
  }

  async decr(key: string) {
    await this.client.decr(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async scan(key: string): Promise<string[]> {
    const [, keyList] = await this.client.scan(0, 'MATCH', `${key}:*`);

    return keyList;
  }

  async expire(key: string) {
    await this.client.expire(key, 0);
  }

  async lpush(key: string, value: string | number) {
    return await this.client.lpush(key, value.toString());
  }

  async rpush(key: string, value: string | number) {
    return await this.client.rpush(key, value.toString());
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return await this.client.llen(key);
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    return await this.client.lrem(key, count, value);
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    return await this.client.ltrim(key, start, stop);
  }

  async deleteAll() {
    return await this.client.flushdb();
  }

  async getList(key: string): Promise<string[]> {
    const list = await this.lrange(key, 0, -1);

    if (list.length < 1)
      throw new ServiceError(
        `no exist keyword, please setting keyword. key: ${key}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return list;
  }
}

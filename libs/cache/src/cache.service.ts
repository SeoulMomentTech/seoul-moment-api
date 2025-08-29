import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly clinet: Redis;

  constructor(private readonly redisService: RedisService) {
    this.clinet = redisService.getOrThrow();
  }

  async get(key: string): Promise<string> {
    const result = await this.clinet.get(key);

    if (!result)
      throw new ServiceError(
        `No content found for the key: "${key}"`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return result;
  }

  async find(key: string): Promise<string | null> {
    const result = await this.clinet.get(key);

    return result;
  }

  async set(key: string, value: string | Buffer | number, expireTime?: number) {
    if (expireTime) {
      const result = await this.clinet.set(key, value, 'EX', expireTime);

      return result;
    }

    const result = await this.clinet.set(key, value);

    return result;
  }

  async incr(key: string) {
    await this.clinet.incr(key);
  }

  async decr(key: string) {
    await this.clinet.decr(key);
  }

  async del(key: string) {
    await this.clinet.del(key);
  }

  async scan(key: string): Promise<string[]> {
    const [, keyList] = await this.clinet.scan(0, 'MATCH', `${key}:*`);

    return keyList;
  }

  async expire(key: string) {
    await this.clinet.expire(key, 0);
  }

  async lpush(key: string, value: string | number) {
    return await this.clinet.lpush(key, value.toString());
  }

  async rpush(key: string, value: string | number) {
    return await this.clinet.rpush(key, value.toString());
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.clinet.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return await this.clinet.llen(key);
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    return await this.clinet.lrem(key, count, value);
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    return await this.clinet.ltrim(key, start, stop);
  }

  async deleteAll() {
    return await this.clinet.flushdb();
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

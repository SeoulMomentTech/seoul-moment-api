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

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];

    return this.client.mget(keys);
  }

  async incr(key: string) {
    await this.client.incr(key);
  }

  /**
   * 카운터를 원자적으로 1 증가시키고 증가 후 값을 반환한다.
   * 최초 생성(=1)일 때만 TTL 을 부여하는 고정 윈도우 카운터.
   * (Redis INCR 은 기존 TTL 을 보존하므로 윈도우가 밀리지 않는다.)
   *
   * incr() 은 반환값이 없어 임계값 비교가 불가능하므로 별도 메서드로 둔다.
   */
  async incrementWithExpire(key: string, expireTime: number): Promise<number> {
    const count = await this.client.incr(key);

    if (count === 1) {
      await this.client.expire(key, expireTime);
    }

    return count;
  }

  /**
   * 키가 없을 때만 저장한다(SET NX EX). 저장했으면 true.
   * 여러 ECS 태스크가 같은 배치를 동시에 돌리거나, 같은 결제를 동시에 확정하지 않게
   * 짧은 락으로 쓴다. TTL 이 지나면 저절로 풀린다.
   */
  async setIfAbsent(
    key: string,
    value: string,
    expireSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', expireSeconds, 'NX');

    return result === 'OK';
  }

  /**
   * 값이 owner 일 때만 지운다 (compare-and-delete). 내 락이 TTL 로 풀린 뒤 남이 잡은
   * 락을 지우지 않게 한다.
   */
  async deleteIfValue(key: string, owner: string): Promise<boolean> {
    const deleted = await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      owner,
    );

    return Number(deleted) === 1;
  }

  /** 값을 꺼내면서 지운다 (원자적). 한 번만 쓰는 nonce 에 쓴다. 없으면 null */
  async take(key: string): Promise<string | null> {
    const value = await this.client.eval(
      "local v = redis.call('get', KEYS[1]); if v then redis.call('del', KEYS[1]) end; return v",
      1,
      key,
    );

    return typeof value === 'string' ? value : null;
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
    return this.lrange(key, 0, -1);
  }
}

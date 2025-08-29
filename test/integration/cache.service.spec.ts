/* eslint-disable max-lines-per-function */
import { CacheService } from '@app/cache/cache.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestCacheModule } from '../setup/test-cache.module';
import { TestSetup } from '../setup/test-setup';

describe('CacheService Integration Tests', () => {
  let cacheService: CacheService;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initializeCache();
    
    module = await Test.createTestingModule({
      imports: [TestCacheModule],
    }).compile();
    
    cacheService = module.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    // Clear cache before each test using TestSetup
    await TestSetup.clearCache();
  });

  it('should set and get a value', async () => {
    const key = 'test:key';
    const value = 'test-value';

    await cacheService.set(key, value);
    const result = await cacheService.get(key);

    expect(result).toBe(value);
  });

  it('should return null when key does not exist', async () => {
    const result = await cacheService.find('non-existent-key');
    expect(result).toBeNull();
  });

  it('should throw error when getting non-existent key', async () => {
    await expect(cacheService.get('non-existent-key')).rejects.toThrow(
      'No content found for the key',
    );
  });

  it('should set value with expiration', async () => {
    const key = 'expiring:key';
    const value = 'expiring-value';
    const expireTime = 1; // 1 second

    await cacheService.set(key, value, expireTime);
    const result = await cacheService.get(key);
    expect(result).toBe(value);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await expect(cacheService.get(key)).rejects.toThrow(
      'No content found for the key',
    );
  });

  it('should increment and decrement values', async () => {
    const key = 'counter:key';

    await cacheService.set(key, '0');
    await cacheService.incr(key);
    let result = await cacheService.get(key);
    expect(result).toBe('1');

    await cacheService.decr(key);
    result = await cacheService.get(key);
    expect(result).toBe('0');
  });

  it('should handle list operations', async () => {
    const key = 'list:key';

    await cacheService.lpush(key, 'first');
    await cacheService.rpush(key, 'second');
    await cacheService.rpush(key, 'third');

    const length = await cacheService.llen(key);
    expect(length).toBe(3);

    const range = await cacheService.lrange(key, 0, -1);
    expect(range).toEqual(['first', 'second', 'third']);

    await cacheService.lrem(key, 1, 'second');
    const newRange = await cacheService.lrange(key, 0, -1);
    expect(newRange).toEqual(['first', 'third']);
  });

  it('should delete all keys from the database', async () => {
    // Set up some test data
    await cacheService.set('key1', 'value1');
    await cacheService.set('key2', 'value2');
    await cacheService.lpush('list1', 'item1');
    await cacheService.lpush('list2', 'item2');

    // Verify data exists
    const value1 = await cacheService.get('key1');
    const value2 = await cacheService.get('key2');
    expect(value1).toBe('value1');
    expect(value2).toBe('value2');

    // Delete all
    await cacheService.deleteAll();

    // Verify all data is deleted
    await expect(cacheService.get('key1')).rejects.toThrow(
      'No content found for the key',
    );
    await expect(cacheService.get('key2')).rejects.toThrow(
      'No content found for the key',
    );
  });

  it('should get list and throw error when list is empty', async () => {
    const key = 'empty:list';

    // Try to get list when it doesn't exist
    await expect(cacheService.getList(key)).rejects.toThrow('no exist keyword');

    // Add items to list
    await cacheService.lpush(key, 'item1');
    await cacheService.lpush(key, 'item2');

    // Get list and verify contents
    const list = await cacheService.getList(key);
    expect(list).toEqual(['item2', 'item1']);

    // Clear list
    await cacheService.del(key);

    // Verify error is thrown again
    await expect(cacheService.getList(key)).rejects.toThrow('no exist keyword');
  });
});

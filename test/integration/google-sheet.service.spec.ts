/* eslint-disable max-lines-per-function */
import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { GoogleSheetService } from '@app/common/module/google-sheet/google-sheet.service';
import { ExternalGoogleSheetService } from '@app/external/google/google-sheet.service';
import { ExternalGoogleModule } from '@app/external/google/google.module';
import { NewsItemDto } from '@app/external/serper/serper.dto';
import { SerperModule } from '@app/external/serper/serper.module';
import { Test, TestingModule } from '@nestjs/testing';

import { TestCacheModule } from '../setup/test-cache.module';
import { TestSetup } from '../setup/test-setup';

jest.setTimeout(100_000);

describe('GoogleSheetService Integration Tests', () => {
  let service: GoogleSheetService;
  let cacheService: CacheService;
  let externalGoogleSheetService: ExternalGoogleSheetService;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initializeCache();

    module = await Test.createTestingModule({
      imports: [TestCacheModule, ExternalGoogleModule, SerperModule],
      providers: [GoogleSheetService],
    }).compile();

    service = module.get<GoogleSheetService>(GoogleSheetService);
    cacheService = module.get<CacheService>(CacheService);
    externalGoogleSheetService = module.get<ExternalGoogleSheetService>(
      ExternalGoogleSheetService,
    );
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    // Clear cache using the local cacheService instance for reliable cleanup
    try {
      // Delete specific Redis key used in tests
      await cacheService.del(RedisKey.GOOGLE_SHEET_KEYWORD);

      // Also scan and delete all keys as backup
      const keys = await cacheService.scan('*');
      for (const key of keys) {
        await cacheService.del(key);
      }
    } catch (error) {
      console.warn('Failed to clear cache in beforeEach:', error.message);
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateGoogleSheetKeyword', () => {
    it('should update keywords in cache', async () => {
      const keywordList = ['keyword1', 'keyword2', 'keyword3'];

      await service.updateGoogleSheetKeyword(keywordList);

      const cachedKeywords = await cacheService.lrange(
        RedisKey.GOOGLE_SHEET_KEYWORD,
        0,
        -1,
      );
      expect(cachedKeywords).toEqual(keywordList);
    });

    it('not exist -> response []', async () => {
      const keywordList = [];

      const cachedKeywords = await cacheService.lrange(
        RedisKey.GOOGLE_SHEET_KEYWORD,
        0,
        -1,
      );
      expect(cachedKeywords).toEqual(keywordList);
    });

    it('should clear existing keywords before updating', async () => {
      const oldKeywords = ['old1', 'old2'];
      const newKeywords = ['new1', 'new2'];

      // Set initial keywords
      await Promise.all(
        oldKeywords.map((keyword) =>
          cacheService.rpush(RedisKey.GOOGLE_SHEET_KEYWORD, keyword),
        ),
      );

      await service.updateGoogleSheetKeyword(newKeywords);

      const cachedKeywords = await cacheService.lrange(
        RedisKey.GOOGLE_SHEET_KEYWORD,
        0,
        -1,
      );
      expect(cachedKeywords).toEqual(newKeywords);
      expect(cachedKeywords).not.toEqual(oldKeywords);
    });
  });

  describe('progressGoogleSheet', () => {
    it('must success progressGoogleSheet', async () => {
      const keywordList = ['올리브영', '무신사'];

      await service.updateGoogleSheetKeyword(keywordList);

      await service.progressGoogleSheet();

      const data = await externalGoogleSheetService.getData(
        '일간',
        NewsItemDto,
      );

      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const firstItem = data[0];
        expect(firstItem).toHaveProperty('keyword');
        expect(firstItem).toHaveProperty('title');
        expect(firstItem).toHaveProperty('link');
        expect(firstItem).toHaveProperty('snippet');
        expect(firstItem).toHaveProperty('date');
        expect(firstItem).toHaveProperty('source');
        expect(firstItem).toHaveProperty('imageUrl');
      }

      await externalGoogleSheetService.deleteSpreadsheet();
    });
  });
});

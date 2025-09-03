import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { HomeModule } from '../../apps/api/src/module/home/home.module';
import { HomeService } from '../../apps/api/src/module/home/home.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('HomeService Integration Tests', () => {
  let homeService: HomeService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, HomeModule],
    }).compile();

    homeService = module.get<HomeService>(HomeService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getHome', () => {
    it('should return empty home response when no data exists', async () => {
      const result = await homeService.getHome(LanguageCode.KOREAN);

      expect(result).toBeDefined();
      expect(result.banner).toEqual([]);
      expect(result.section).toEqual([]);
      expect(result.news).toEqual([]);
      expect(result.article).toEqual([]);
    });

    it('should return home with banners and sections only when no news/articles exist', async () => {
      // Create home data with banners only
      await testDataFactory.createFullHome({
        banners: [
          { sortOrder: 1, imageUrl: '/banner1.jpg' },
          { sortOrder: 2, imageUrl: '/banner2.jpg' },
        ],
        sections: [],
      });

      // Create multilingual section separately
      const { section, languages } =
        await testDataFactory.createMultilingualHomeSection(
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
          {
            title: {
              [LanguageCode.KOREAN]: '섹션 제목',
              [LanguageCode.ENGLISH]: 'Section Title',
            },
            description: {
              [LanguageCode.KOREAN]: '섹션 설명',
              [LanguageCode.ENGLISH]: 'Section Description',
            },
          },
        );
      await testDataFactory.createHomeSectionImage(section, {
        imageUrl: '/section1-image1.jpg',
        sortOrder: 1,
      });

      const result = await homeService.getHome(LanguageCode.KOREAN);

      expect(result.banner).toHaveLength(2);
      expect(result.banner[0]).toBe(
        'https://image-dev.seoulmoment.com.tw/banner1.jpg',
      );
      expect(result.banner[1]).toBe(
        'https://image-dev.seoulmoment.com.tw/banner2.jpg',
      );

      expect(result.section).toHaveLength(1);
      expect(result.section[0].title).toBe('섹션 제목');
      expect(result.section[0].description).toBe('섹션 설명');
      expect(result.section[0].url).toBe('https://example.com/section1');
      expect(result.section[0].image).toHaveLength(1);
      expect(result.section[0].image[0]).toBe(
        'https://image-dev.seoulmoment.com.tw/section1-image1.jpg',
      );

      expect(result.news).toEqual([]);
      expect(result.article).toEqual([]);
    });

    it('should return home with news when news exist', async () => {
      // Create home banners
      await testDataFactory.createFullHome({
        banners: [{ sortOrder: 1, imageUrl: '/banner1.jpg' }],
        sections: [],
      });

      // Create brand and news
      const news1 = await testDataFactory.createFullNews({
        brand: {},
        news: { writer: 'Writer 1', banner: '/news1-banner.jpg' },
        sections: [],
      });

      const news2 = await testDataFactory.createFullNews({
        brand: {},
        news: { writer: 'Writer 2', banner: '/news2-banner.jpg' },
        sections: [],
      });

      const news3 = await testDataFactory.createFullNews({
        brand: {},
        news: { writer: 'Writer 3', banner: '/news3-banner.jpg' },
        sections: [],
      });

      const news4 = await testDataFactory.createFullNews({
        brand: {},
        news: { writer: 'Writer 4', banner: '/news4-banner.jpg' },
        sections: [],
      });

      // Create multilingual texts for news
      const languages = await testDataFactory.createDefaultLanguages();
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news1.id,
        'title',
        languages.korean,
        '뉴스 1 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news1.id,
        'content',
        languages.korean,
        '뉴스 1 내용',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news2.id,
        'title',
        languages.korean,
        '뉴스 2 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news2.id,
        'content',
        languages.korean,
        '뉴스 2 내용',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news3.id,
        'title',
        languages.korean,
        '뉴스 3 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news3.id,
        'content',
        languages.korean,
        '뉴스 3 내용',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news4.id,
        'title',
        languages.korean,
        '뉴스 4 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news4.id,
        'content',
        languages.korean,
        '뉴스 4 내용',
      );

      const result = await homeService.getHome(LanguageCode.KOREAN);

      expect(result.banner).toHaveLength(1);
      expect(result.section).toEqual([]);
      expect(result.news).toHaveLength(3); // 최신 3개만
      expect(result.article).toEqual([]);

      // 최신 3개 뉴스 확인 (createDate DESC 순서)
      expect(result.news[0].title).toBe('뉴스 4 제목');
      expect(result.news[0].writer).toBe('Writer 4');
      expect(result.news[1].title).toBe('뉴스 3 제목');
      expect(result.news[1].writer).toBe('Writer 3');
      expect(result.news[2].title).toBe('뉴스 2 제목');
      expect(result.news[2].writer).toBe('Writer 2');
    });

    it('should return home with articles when articles exist', async () => {
      // Create home banners
      await testDataFactory.createFullHome({
        banners: [{ sortOrder: 1, imageUrl: '/banner1.jpg' }],
        sections: [],
      });

      // Create brand and articles
      const article1 = await testDataFactory.createFullArticle({
        brand: {},
        article: { writer: 'Writer 1', banner: '/article1-banner.jpg' },
        sections: [],
      });

      const article2 = await testDataFactory.createFullArticle({
        brand: {},
        article: { writer: 'Writer 2', banner: '/article2-banner.jpg' },
        sections: [],
      });

      const article3 = await testDataFactory.createFullArticle({
        brand: {},
        article: { writer: 'Writer 3', banner: '/article3-banner.jpg' },
        sections: [],
      });

      // Create multilingual texts for articles
      const languages = await testDataFactory.createDefaultLanguages();
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article1.id,
        'title',
        languages.korean,
        '아티클 1 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article1.id,
        'content',
        languages.korean,
        '아티클 1 내용',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article2.id,
        'title',
        languages.korean,
        '아티클 2 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article2.id,
        'content',
        languages.korean,
        '아티클 2 내용',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article3.id,
        'title',
        languages.korean,
        '아티클 3 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article3.id,
        'content',
        languages.korean,
        '아티클 3 내용',
      );

      const result = await homeService.getHome(LanguageCode.KOREAN);

      expect(result.banner).toHaveLength(1);
      expect(result.section).toEqual([]);
      expect(result.news).toEqual([]);
      expect(result.article).toHaveLength(2); // 최신 2개만

      // 최신 2개 아티클 확인 (createDate DESC 순서)
      expect(result.article[0].title).toBe('아티클 3 제목');
      expect(result.article[0].writer).toBe('Writer 3');
      expect(result.article[1].title).toBe('아티클 2 제목');
      expect(result.article[1].writer).toBe('Writer 2');
    });

    it('should return complete home data with all components', async () => {
      // Create home data with banners only
      await testDataFactory.createFullHome({
        banners: [
          { sortOrder: 1, imageUrl: '/banner1.jpg' },
          { sortOrder: 2, imageUrl: '/banner2.jpg' },
        ],
        sections: [],
      });

      // Create multilingual section separately
      const { section, languages } =
        await testDataFactory.createMultilingualHomeSection(
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
          {
            title: {
              [LanguageCode.KOREAN]: '섹션 제목',
            },
            description: {
              [LanguageCode.KOREAN]: '섹션 설명',
            },
          },
        );

      await testDataFactory.createHomeSectionImage(section, {
        imageUrl: '/section1-image1.jpg',
        sortOrder: 1,
      });

      await testDataFactory.createHomeSectionImage(section, {
        imageUrl: '/section1-image2.jpg',
        sortOrder: 2,
      });

      // Create news
      const news = await testDataFactory.createFullNews({
        brand: {},
        news: { writer: 'News Writer', banner: '/news-banner.jpg' },
        sections: [],
      });
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'title',
        languages.korean,
        '뉴스 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'content',
        languages.korean,
        '뉴스 내용',
      );

      // Create article
      const article = await testDataFactory.createFullArticle({
        brand: {},
        article: { writer: 'Article Writer', banner: '/article-banner.jpg' },
        sections: [],
      });
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.korean,
        '아티클 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.korean,
        '아티클 내용',
      );

      const result = await homeService.getHome(LanguageCode.KOREAN);

      // 모든 컴포넌트 확인
      expect(result.banner).toHaveLength(2);
      expect(result.section).toHaveLength(1);
      expect(result.section[0].title).toBe('섹션 제목');
      expect(result.section[0].image).toHaveLength(2);
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('뉴스 제목');
      expect(result.article).toHaveLength(1);
      expect(result.article[0].title).toBe('아티클 제목');
    });

    it('should return different content based on language', async () => {
      // Create section with multilingual content
      const { section, languages } =
        await testDataFactory.createMultilingualHomeSection(
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
          {
            title: {
              [LanguageCode.KOREAN]: '한국어 제목',
              [LanguageCode.ENGLISH]: 'English Title',
              [LanguageCode.CHINESE]: '中文标题',
            },
            description: {
              [LanguageCode.KOREAN]: '한국어 설명',
              [LanguageCode.ENGLISH]: 'English Description',
              [LanguageCode.CHINESE]: '中文描述',
            },
          },
        );

      // Korean
      const koreanResult = await homeService.getHome(LanguageCode.KOREAN);
      expect(koreanResult.section[0].title).toBe('한국어 제목');
      expect(koreanResult.section[0].description).toBe('한국어 설명');

      // English
      const englishResult = await homeService.getHome(LanguageCode.ENGLISH);
      expect(englishResult.section[0].title).toBe('English Title');
      expect(englishResult.section[0].description).toBe('English Description');

      // Chinese
      const chineseResult = await homeService.getHome(LanguageCode.CHINESE);
      expect(chineseResult.section[0].title).toBe('中文标题');
      expect(chineseResult.section[0].description).toBe('中文描述');
    });

    it('should handle sections without multilingual text gracefully', async () => {
      // Create section without multilingual text
      await testDataFactory.createFullHome({
        banners: [],
        sections: [
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
        ],
      });

      const result = await homeService.getHome(LanguageCode.KOREAN);

      expect(result.section).toHaveLength(1);
      expect(result.section[0].title).toBe(null);
      expect(result.section[0].description).toBe(null);
      expect(result.section[0].url).toBe('https://example.com/section1');
    });
  });
});

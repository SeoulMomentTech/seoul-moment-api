import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { ArticleSectionEntity } from '../libs/repository/src/entity/article-section.entity';
import { ArticleEntity } from '../libs/repository/src/entity/article.entity';
import { BrandSectionEntity } from '../libs/repository/src/entity/brand-section.entity';
import { BrandEntity } from '../libs/repository/src/entity/brand.entity';
import { CategoryEntity } from '../libs/repository/src/entity/category.entity';
import { NewsSectionEntity } from '../libs/repository/src/entity/news-section.entity';
import { NewsEntity } from '../libs/repository/src/entity/news.entity';
import { PartnerCategoryEntity } from '../libs/repository/src/entity/partner-category.entity';
import { PartnerEntity } from '../libs/repository/src/entity/partner.entity';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { ArticleRepositoryService } from '../libs/repository/src/service/article.repository.service';
import { BrandRepositoryService } from '../libs/repository/src/service/brand.repository.service';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';
import { NewsRepositoryService } from '../libs/repository/src/service/news.repository.service';

describe('Client multilingual smoke (Phase 2 regression)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;
  let brandRepositoryService: BrandRepositoryService;
  let newsRepositoryService: NewsRepositoryService;
  let articleRepositoryService: ArticleRepositoryService;

  let categoryId: number;

  beforeAll(async () => {
    // Given - 앱/서비스/시드
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app);

    languageRepositoryService = app.get(LanguageRepositoryService);
    brandRepositoryService = app.get(BrandRepositoryService);
    newsRepositoryService = app.get(NewsRepositoryService);
    articleRepositoryService = app.get(ArticleRepositoryService);

    const languages = await dataSource.query(`SELECT id FROM language LIMIT 1`);
    if (languages.length === 0) {
      await dataSource.query(
        `INSERT INTO language (code, name, english_name, is_active, sort_order)
         VALUES ('ko', '한국어', 'Korean', true, 1),
                ('en', 'English', 'English', true, 2),
                ('zh-TW', '中文', 'Taiwan', true, 3)`,
      );
    }

    const categories = await dataSource.query(
      `SELECT id FROM category LIMIT 1`,
    );
    if (categories.length > 0) {
      categoryId = categories[0].id;
    } else {
      const saved = await dataSource
        .getRepository(CategoryEntity)
        .save({ sortOrder: 1 } as Partial<CategoryEntity>);
      categoryId = saved.id;
    }
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'article_section_image',
      'article_section',
      'article',
      'news_section_image',
      'news_section',
      'news',
      'brand_section_image',
      'brand_section',
      'brand_mobile_banner_image',
      'brand_banner_image',
      'brand',
      'partner',
      'partner_category',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function saveText(
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    ko: string,
    en?: string,
  ) {
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      entityType,
      entityId,
      fieldName,
      LanguageCode.KOREAN,
      ko,
    );
    if (en) {
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        entityType,
        entityId,
        fieldName,
        LanguageCode.ENGLISH,
        en,
      );
    }
  }

  // -----------------------------------------------------------------------
  // GET /category
  // -----------------------------------------------------------------------
  describe('GET /category', () => {
    it('카테고리 목록 조회 시 200과 다국어 name을 반환한다', async () => {
      // Given - 카테고리 다국어 추가 (기본 category 이미 존재)
      await saveText(
        EntityType.CATEGORY,
        categoryId,
        'name',
        '카테고리',
        'Cat',
      );

      // When
      const res = await request(app.getHttpServer())
        .get('/category')
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.list)).toBe(true);
      const target = res.body.data.list.find(
        (c: { id: number }) => c.id === categoryId,
      );
      expect(target).toBeDefined();
      expect(typeof target.name).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // GET /brand/:id
  // -----------------------------------------------------------------------
  describe('GET /brand/:id', () => {
    it('브랜드 상세 조회 시 200과 다국어 name/description을 반환한다', async () => {
      // Given
      const brand = await brandRepositoryService.insert({
        categoryId,
        englishName: faker.company.name(),
      } as BrandEntity);
      await saveText(EntityType.BRAND, brand.id, 'name', '브랜드', 'Brand');
      await saveText(EntityType.BRAND, brand.id, 'description', '설명', 'Desc');

      const section = await brandRepositoryService.insertSection({
        brandId: brand.id,
        sortOrder: 1,
      } as BrandSectionEntity);
      await saveText(
        EntityType.BRAND_SECTION,
        section.id,
        'title',
        '섹션제목',
        'SectionTitle',
      );

      // When
      const res = await request(app.getHttpServer())
        .get(`/brand/${brand.id}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.name).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // GET /news/list, GET /news/:id
  // -----------------------------------------------------------------------
  describe('GET /news', () => {
    it('뉴스 목록/상세 조회 시 200과 다국어 필드를 반환한다', async () => {
      // Given
      const news = await newsRepositoryService.insert({
        categoryId,
        writer: faker.person.fullName(),
      } as NewsEntity);
      await saveText(
        EntityType.NEWS,
        news.id,
        'title',
        '뉴스제목',
        'NewsTitle',
      );
      await saveText(EntityType.NEWS, news.id, 'content', '내용', 'Content');

      const section = await newsRepositoryService.insertSection({
        newsId: news.id,
        sortOrder: 1,
      } as NewsSectionEntity);
      await saveText(
        EntityType.NEWS_SECTION,
        section.id,
        'content',
        '섹션내용',
        'SectionContent',
      );
      await saveText(EntityType.CATEGORY, categoryId, 'name', '카테고리');

      // When - list
      const listRes = await request(app.getHttpServer())
        .get('/news/list')
        .query({ count: 10 })
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data.list)).toBe(true);

      // When - detail
      const detailRes = await request(app.getHttpServer())
        .get(`/news/${news.id}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // GET /article/list, GET /article/:id
  // -----------------------------------------------------------------------
  describe('GET /article', () => {
    it('아티클 목록/상세 조회 시 200과 다국어 필드를 반환한다', async () => {
      // Given
      const article = await articleRepositoryService.insert({
        categoryId,
        writer: faker.person.fullName(),
      } as ArticleEntity);
      await saveText(
        EntityType.ARTICLE,
        article.id,
        'title',
        '아티클제목',
        'ArticleTitle',
      );
      await saveText(
        EntityType.ARTICLE,
        article.id,
        'content',
        '내용',
        'Content',
      );

      const section = await articleRepositoryService.insertSection({
        articleId: article.id,
        sortOrder: 1,
      } as ArticleSectionEntity);
      await saveText(
        EntityType.ARTICLE_SECTION,
        section.id,
        'content',
        '섹션내용',
        'SectionContent',
      );
      await saveText(EntityType.CATEGORY, categoryId, 'name', '카테고리');

      // When - list
      const listRes = await request(app.getHttpServer())
        .get('/article/list')
        .query({ count: 10 })
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data.list)).toBe(true);

      // When - detail
      const detailRes = await request(app.getHttpServer())
        .get(`/article/${article.id}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // GET /partner, GET /partner/category
  // -----------------------------------------------------------------------
  describe('GET /partner', () => {
    it('파트너 및 카테고리 조회 시 200과 다국어 필드를 반환한다', async () => {
      // Given
      const partnerCategory = await dataSource
        .getRepository(PartnerCategoryEntity)
        .save({ sortOrder: 1 } as Partial<PartnerCategoryEntity>);
      await saveText(
        EntityType.PARTNER_CATEGORY,
        partnerCategory.id,
        'name',
        '카테고리',
        'PartnerCat',
      );

      const partner = await dataSource.getRepository(PartnerEntity).save({
        partnerCategoryId: partnerCategory.id,
      } as Partial<PartnerEntity>);
      await saveText(
        EntityType.PARTNER,
        partner.id,
        'title',
        '파트너',
        'Partner',
      );
      await saveText(
        EntityType.PARTNER,
        partner.id,
        'description',
        '설명',
        'Desc',
      );

      // When - partner list
      const partnerRes = await request(app.getHttpServer())
        .get('/partner')
        .query({ partnerCategoryId: partnerCategory.id })
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(partnerRes.status).toBe(200);

      // When - partner/category
      const catRes = await request(app.getHttpServer())
        .get('/partner/category')
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(catRes.status).toBe(200);
    });
  });
});

import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ArticleEntity } from '../libs/repository/src/entity/article.entity';
import { ArticleSectionEntity } from '../libs/repository/src/entity/article-section.entity';
import { BrandSectionEntity } from '../libs/repository/src/entity/brand-section.entity';
import { BrandEntity } from '../libs/repository/src/entity/brand.entity';
import { CategoryEntity } from '../libs/repository/src/entity/category.entity';
import { NewsEntity } from '../libs/repository/src/entity/news.entity';
import { NewsSectionEntity } from '../libs/repository/src/entity/news-section.entity';
import { OptionEntity } from '../libs/repository/src/entity/option.entity';
import { OptionValueEntity } from '../libs/repository/src/entity/option-value.entity';
import { ProductEntity } from '../libs/repository/src/entity/product.entity';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { ArticleRepositoryService } from '../libs/repository/src/service/article.repository.service';
import { BrandRepositoryService } from '../libs/repository/src/service/brand.repository.service';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';
import { NewsRepositoryService } from '../libs/repository/src/service/news.repository.service';
import { OptionRepositoryService } from '../libs/repository/src/service/option.repository.service';
import { ProductRepositoryService } from '../libs/repository/src/service/product.repository.service';
import { getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

describe('Cascade Delete (multilingual_text)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;
  let articleRepositoryService: ArticleRepositoryService;
  let brandRepositoryService: BrandRepositoryService;
  let newsRepositoryService: NewsRepositoryService;
  let productRepositoryService: ProductRepositoryService;
  let optionRepositoryService: OptionRepositoryService;

  let categoryId: number;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 및 서비스 주입
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app);

    languageRepositoryService = app.get(LanguageRepositoryService);
    articleRepositoryService = app.get(ArticleRepositoryService);
    brandRepositoryService = app.get(BrandRepositoryService);
    newsRepositoryService = app.get(NewsRepositoryService);
    productRepositoryService = app.get(ProductRepositoryService);
    optionRepositoryService = app.get(OptionRepositoryService);

    // Given - 언어/카테고리 시드
    await ensureSeedData();
  }, 60_000);

  async function ensureSeedData() {
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
  }

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
      'product',
      'option_value',
      'option',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -----------------------------------------------------------------------
  // BrandRepositoryService.deleteWithMultilingual
  // -----------------------------------------------------------------------
  describe('BrandRepositoryService.deleteWithMultilingual', () => {
    it('brand + brand_section의 multilingual_text를 모두 삭제한다', async () => {
      // Given - brand 및 section 저장
      const brand = await brandRepositoryService.insert({
        categoryId,
        englishName: faker.company.name(),
      } as BrandEntity);

      const section = await brandRepositoryService.insertSection({
        brandId: brand.id,
        sortOrder: 1,
      } as BrandSectionEntity);

      // Given - 다국어 데이터
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        brand.id,
        'name',
        LanguageCode.KOREAN,
        '브랜드명',
      );
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.BRAND_SECTION,
        section.id,
        'title',
        LanguageCode.KOREAN,
        '섹션제목',
      );

      // When
      await brandRepositoryService.deleteWithMultilingual(brand.id);

      // Then
      const brandRow = await dataSource.query(
        `SELECT id FROM brand WHERE id = $1`,
        [brand.id],
      );
      const brandTexts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'brand' AND entity_id = $1`,
        [brand.id],
      );
      const sectionTexts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'brand_section' AND entity_id = $1`,
        [section.id],
      );

      expect(brandRow).toHaveLength(0);
      expect(brandTexts[0].count).toBe(0);
      expect(sectionTexts[0].count).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // ArticleRepositoryService.deleteWithMultilingual
  // -----------------------------------------------------------------------
  describe('ArticleRepositoryService.deleteWithMultilingual', () => {
    it('article + article_section의 multilingual_text를 모두 삭제한다', async () => {
      // Given - article 및 section 저장
      const article = await articleRepositoryService.insert({
        categoryId,
        writer: faker.person.fullName(),
      } as ArticleEntity);

      const section = await articleRepositoryService.insertSection({
        articleId: article.id,
        sortOrder: 1,
      } as ArticleSectionEntity);

      // Given - 다국어 데이터 삽입
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.ARTICLE,
        article.id,
        'title',
        LanguageCode.KOREAN,
        '아티클제목',
      );
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.ARTICLE_SECTION,
        section.id,
        'content',
        LanguageCode.KOREAN,
        '섹션내용',
      );

      // When
      await articleRepositoryService.deleteWithMultilingual(article.id);

      // Then - article/section 엔티티 및 multilingual_text 모두 삭제
      const articleRow = await dataSource.query(
        `SELECT id FROM article WHERE id = $1`,
        [article.id],
      );
      const sectionRow = await dataSource.query(
        `SELECT id FROM article_section WHERE id = $1`,
        [section.id],
      );
      const articleTexts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'article' AND entity_id = $1`,
        [article.id],
      );
      const sectionTexts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'article_section' AND entity_id = $1`,
        [section.id],
      );

      expect(articleRow).toHaveLength(0);
      expect(sectionRow).toHaveLength(0);
      expect(articleTexts[0].count).toBe(0);
      expect(sectionTexts[0].count).toBe(0);
    });

    it('존재하지 않는 id로 호출하면 예외 없이 종료된다', async () => {
      // When / Then
      await expect(
        articleRepositoryService.deleteWithMultilingual(999_999),
      ).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // NewsRepositoryService.deleteWithMultilingual
  // -----------------------------------------------------------------------
  describe('NewsRepositoryService.deleteWithMultilingual', () => {
    it('news + news_section의 multilingual_text를 모두 삭제한다', async () => {
      // Given
      const news = await newsRepositoryService.insert({
        categoryId,
        writer: faker.person.fullName(),
      } as NewsEntity);
      const section = await newsRepositoryService.insertSection({
        newsId: news.id,
        sortOrder: 1,
      } as NewsSectionEntity);

      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.NEWS,
        news.id,
        'title',
        LanguageCode.KOREAN,
        '뉴스제목',
      );
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.NEWS_SECTION,
        section.id,
        'content',
        LanguageCode.KOREAN,
        '섹션내용',
      );

      // When
      await newsRepositoryService.deleteWithMultilingual(news.id);

      // Then
      const newsRow = await dataSource.query(
        `SELECT id FROM news WHERE id = $1`,
        [news.id],
      );
      const newsTexts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'news' AND entity_id = $1`,
        [news.id],
      );
      const sectionTexts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'news_section' AND entity_id = $1`,
        [section.id],
      );

      expect(newsRow).toHaveLength(0);
      expect(newsTexts[0].count).toBe(0);
      expect(sectionTexts[0].count).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // ProductRepositoryService.deleteWithMultilingual
  // -----------------------------------------------------------------------
  describe('ProductRepositoryService.deleteWithMultilingual', () => {
    it('product 삭제 시 multilingual_text도 함께 삭제된다', async () => {
      // Given - 브랜드는 필수(categoryId 유사하게 직접 삽입)
      const brand = await dataSource.query(
        `INSERT INTO brand (category_id, english_name) VALUES ($1, $2) RETURNING id`,
        [categoryId, faker.company.name()],
      );
      const brandId = brand[0].id;

      const product = await productRepositoryService.insert({
        brandId,
        categoryId,
      } as ProductEntity);

      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.PRODUCT,
        product.id,
        'name',
        LanguageCode.KOREAN,
        '상품명',
      );

      // When
      await productRepositoryService.deleteWithMultilingual(product.id);

      // Then
      const productRow = await dataSource.query(
        `SELECT id FROM product WHERE id = $1`,
        [product.id],
      );
      const productTexts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'product' AND entity_id = $1`,
        [product.id],
      );

      expect(productRow).toHaveLength(0);
      expect(productTexts[0].count).toBe(0);

      // Cleanup - brand는 afterEach 테이블 목록에 없으므로 정리
      await dataSource.query(`DELETE FROM brand WHERE id = $1`, [brandId]);
    });
  });

  // -----------------------------------------------------------------------
  // OptionRepositoryService
  // -----------------------------------------------------------------------
  describe('OptionRepositoryService cascade', () => {
    it('deleteOptionWithMultilingual은 option의 multilingual_text를 삭제한다', async () => {
      // Given
      const option = await optionRepositoryService.insertOption({
        type: 'color',
      } as OptionEntity);

      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.OPTION,
        option.id,
        'name',
        LanguageCode.KOREAN,
        '색상',
      );

      // When
      await optionRepositoryService.deleteOptionWithMultilingual(option.id);

      // Then
      const row = await dataSource.query(
        `SELECT id FROM "option" WHERE id = $1`,
        [option.id],
      );
      const texts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'option' AND entity_id = $1`,
        [option.id],
      );

      expect(row).toHaveLength(0);
      expect(texts[0].count).toBe(0);
    });

    it('deleteOptionValueWithMultilingual은 option_value의 multilingual_text를 삭제한다', async () => {
      // Given
      const option = await optionRepositoryService.insertOption({
        type: 'color',
      } as OptionEntity);
      const value = await optionRepositoryService.insertOptionValue({
        optionId: option.id,
      } as OptionValueEntity);

      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.OPTION_VALUE,
        value.id,
        'value',
        LanguageCode.KOREAN,
        '빨강',
      );

      // When
      await optionRepositoryService.deleteOptionValueWithMultilingual(value.id);

      // Then
      const row = await dataSource.query(
        `SELECT id FROM option_value WHERE id = $1`,
        [value.id],
      );
      const texts = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM multilingual_text
         WHERE entity_type = 'option_value' AND entity_id = $1`,
        [value.id],
      );

      expect(row).toHaveLength(0);
      expect(texts[0].count).toBe(0);
    });
  });
});

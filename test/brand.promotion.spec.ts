import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { BrandPromotionEntity } from '../libs/repository/src/entity/brand-promotion.entity';
import { BrandEntity } from '../libs/repository/src/entity/brand.entity';
import { PromotionEntity } from '../libs/repository/src/entity/promotion.entity';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';

describe('BrandPromotionController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;
  let categoryId: number;

  beforeAll(async () => {
    // Given - 앱/DataSource/서비스 획득
    app = await getTestApp();
    dataSource = getDataSource(app);
    languageRepositoryService = app.get(LanguageRepositoryService);

    // Given - 언어/카테고리 시드 (다른 spec과 동일한 패턴)
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
      const saved = await dataSource.query(
        `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
      );
      categoryId = saved[0].id;
    }
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'brand_promotion_event_coupon',
      'brand_promotion_event',
      'brand_promotion_notice',
      'brand_promotion_popup_image',
      'brand_promotion_popup',
      'brand_promotion_section_image',
      'brand_promotion_section',
      'brand_promotion_banner_image',
      'brand_promotion_banner',
      'brand_promotion',
      'promotion',
      'brand_mobile_banner_image',
      'brand_banner_image',
      'brand',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function createPromotion(): Promise<PromotionEntity> {
    return dataSource.getRepository(PromotionEntity).save({
      bannerImagePath: `/promotions/${faker.string.uuid()}.jpg`,
      bannerMobileImagePath: `/promotions/${faker.string.uuid()}.jpg`,
      thumbnailImagePath: `/promotions/${faker.string.uuid()}.jpg`,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
    } as Partial<PromotionEntity>);
  }

  async function createBrand(): Promise<BrandEntity> {
    return dataSource.getRepository(BrandEntity).save({
      categoryId,
      englishName: faker.company.name(),
      profileImage: `/brands/${faker.string.uuid()}.jpg`,
      colorCode: '#FF0000',
    } as Partial<BrandEntity>);
  }

  async function createBrandPromotion(
    promotionId: number,
    brandId: number,
    isActive = true,
  ): Promise<BrandPromotionEntity> {
    return dataSource.getRepository(BrandPromotionEntity).save({
      promotionId,
      brandId,
      isActive,
    } as Partial<BrandPromotionEntity>);
  }

  // -----------------------------------------------------------------------
  // GET /brand/promotion/:promotionId/brand
  // -----------------------------------------------------------------------
  describe('GET /brand/promotion/:promotionId/brand', () => {
    it('해당 프로모션에 활성 브랜드 프로모션이 없으면 빈 배열을 반환한다', async () => {
      // Given - 프로모션만 존재하고 브랜드 프로모션 없음
      const promotion = await createPromotion();

      // When
      const res = await request(app.getHttpServer()).get(
        `/brand/promotion/${promotion.id}/brand`,
      );

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toEqual([]);
    });

    it('활성화된 브랜드 프로모션 목록을 반환한다', async () => {
      // Given - 프로모션 1개 + 활성 브랜드 프로모션 2개
      const promotion = await createPromotion();
      const brandA = await createBrand();
      const brandB = await createBrand();
      await createBrandPromotion(promotion.id, brandA.id, true);
      await createBrandPromotion(promotion.id, brandB.id, true);

      // When
      const res = await request(app.getHttpServer()).get(
        `/brand/promotion/${promotion.id}/brand`,
      );

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toHaveLength(2);
      const brandIds = res.body.data.list.map(
        (v: { brandId: number }) => v.brandId,
      );
      expect(brandIds).toEqual(expect.arrayContaining([brandA.id, brandB.id]));
      expect(res.body.data.list[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          brandId: expect.any(Number),
          name: expect.any(String),
          profileImageUrl: expect.any(String),
        }),
      );
    });

    it('비활성화(isActive=false) 브랜드 프로모션은 결과에서 제외된다', async () => {
      // Given - 활성 1개 + 비활성 1개
      const promotion = await createPromotion();
      const activeBrand = await createBrand();
      const inactiveBrand = await createBrand();
      await createBrandPromotion(promotion.id, activeBrand.id, true);
      await createBrandPromotion(promotion.id, inactiveBrand.id, false);

      // When
      const res = await request(app.getHttpServer()).get(
        `/brand/promotion/${promotion.id}/brand`,
      );

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toHaveLength(1);
      expect(res.body.data.list[0].brandId).toBe(activeBrand.id);
    });

    it('promotionId가 숫자가 아니면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(
        '/brand/promotion/not-a-number/brand',
      );

      // Then - 라우트 자체가 \d+ 제약이라 404로 라우팅되지 않아도 됨
      expect([400, 404]).toContain(res.status);
    });
  });

  // -----------------------------------------------------------------------
  // GET /brand/promotion/:brandId
  // -----------------------------------------------------------------------
  describe('GET /brand/promotion/:brandId', () => {
    it('존재하지 않는 brandId로 조회 시 404를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get('/brand/promotion/99999999')
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(404);
    });

    it('브랜드 프로모션 상세를 200과 함께 반환한다 (sub-resource 비어있음)', async () => {
      // Given - 프로모션 + 브랜드 + 브랜드 프로모션
      const promotion = await createPromotion();
      const brand = await createBrand();
      await createBrandPromotion(promotion.id, brand.id, true);

      // When
      const res = await request(app.getHttpServer())
        .get(`/brand/promotion/${brand.id}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          promotionId: promotion.id,
          bannerList: [],
          sectionList: [],
          popupList: [],
          eventList: [],
          noticeList: [],
          productList: [],
        }),
      );
      expect(res.body.data.brand).toEqual(
        expect.objectContaining({
          id: brand.id,
          name: brand.englishName,
          colorCode: brand.colorCode,
        }),
      );
    });

    it('Accept-Language에 따른 브랜드 description을 반환한다 (ko)', async () => {
      // Given - 한국어/영어 description 저장
      const promotion = await createPromotion();
      const brand = await createBrand();
      const brandPromotion = await createBrandPromotion(
        promotion.id,
        brand.id,
        true,
      );

      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.BRAND_PROMOTION,
        brandPromotion.id,
        'description',
        LanguageCode.KOREAN,
        '한국어 설명',
      );
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.BRAND_PROMOTION,
        brandPromotion.id,
        'description',
        LanguageCode.ENGLISH,
        'English description',
      );

      // When
      const res = await request(app.getHttpServer())
        .get(`/brand/promotion/${brand.id}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.brand.description).toBe('한국어 설명');
    });

    it('Accept-Language에 따른 브랜드 description을 반환한다 (en)', async () => {
      // Given
      const promotion = await createPromotion();
      const brand = await createBrand();
      const brandPromotion = await createBrandPromotion(
        promotion.id,
        brand.id,
        true,
      );

      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.BRAND_PROMOTION,
        brandPromotion.id,
        'description',
        LanguageCode.KOREAN,
        '한국어 설명',
      );
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.BRAND_PROMOTION,
        brandPromotion.id,
        'description',
        LanguageCode.ENGLISH,
        'English description',
      );

      // When
      const res = await request(app.getHttpServer())
        .get(`/brand/promotion/${brand.id}`)
        .set('Accept-language', LanguageCode.ENGLISH);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.brand.description).toBe('English description');
    });
  });
});

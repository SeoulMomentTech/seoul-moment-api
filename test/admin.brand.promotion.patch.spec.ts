import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { BrandPromotionEntity } from '../libs/repository/src/entity/brand-promotion.entity';
import { BrandEntity } from '../libs/repository/src/entity/brand.entity';
import { PromotionEntity } from '../libs/repository/src/entity/promotion.entity';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';

const BASE_URL = '/admin/brand/promotion';
const IMAGE_DOMAIN = 'https://image-dev.seoulmoment.com.tw';

describe('AdminBrandPromotionController PATCH (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let categoryId: number;
  let languageIds: Record<LanguageCode, number>;

  beforeAll(async () => {
    // Given - 앱/DataSource
    app = await getTestApp();
    dataSource = getDataSource(app);

    // Given - 언어/카테고리 시드
    const languages = await dataSource.query(
      `SELECT id, code FROM language ORDER BY id`,
    );
    if (languages.length === 0) {
      await dataSource.query(
        `INSERT INTO language (code, name, english_name, is_active, sort_order)
         VALUES ('ko', '한국어', 'Korean', true, 1),
                ('en', 'English', 'English', true, 2),
                ('zh-TW', '中文', 'Taiwan', true, 3)`,
      );
    }
    const refreshed = await dataSource.query(
      `SELECT id, code FROM language ORDER BY id`,
    );
    languageIds = Object.fromEntries(
      refreshed.map((l: { id: number; code: string }) => [l.code, l.id]),
    ) as Record<LanguageCode, number>;

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

  function buildPatchBody(overrides: {
    promotionId: number;
    brandId: number;
    isActive?: boolean;
  }) {
    return {
      promotionId: overrides.promotionId,
      brandId: overrides.brandId,
      isActive: overrides.isActive ?? true,
      brandDescriptionLanguage: [
        { languageCode: LanguageCode.KOREAN, description: '설명' },
        { languageCode: LanguageCode.ENGLISH, description: 'DESCRIPTION' },
        { languageCode: LanguageCode.TAIWAN, description: '중국어중국어' },
      ],
      bannerList: [
        {
          imageUrl: `${IMAGE_DOMAIN}/brand-promotion-banners/2025-09-16/banner-01.jpg`,
          mobileImageUrl: `${IMAGE_DOMAIN}/brand-promotion-banners/2025-09-16/banner-01-mobile.jpg`,
          linkUrl: 'https://example.com',
          language: [
            { languageCode: LanguageCode.KOREAN, title: '배너 제목' },
            { languageCode: LanguageCode.ENGLISH, title: 'BANNER TITLE' },
            { languageCode: LanguageCode.TAIWAN, title: '中文标题' },
          ],
        },
      ],
      sectionList: [
        {
          type: 'TYPE_1',
          imageUrlList: [
            `${IMAGE_DOMAIN}/brand-promotion-sections/2025-09-16/section-01.jpg`,
            `${IMAGE_DOMAIN}/brand-promotion-sections/2025-09-16/section-02.jpg`,
          ],
        },
      ],
      popupList: [
        {
          place: '장소',
          address: '주소',
          latitude: 37.5665,
          longitude: 127.036344,
          startDate: '2025-01-01',
          startTime: '10:00',
          endDate: '2025-03-01',
          endTime: '20:00',
          isActive: true,
          language: [
            {
              languageCode: LanguageCode.KOREAN,
              title: '팝업 제목',
              description: '팝업 설명',
            },
            {
              languageCode: LanguageCode.ENGLISH,
              title: 'POPUP',
              description: 'POPUP DESC',
            },
            {
              languageCode: LanguageCode.TAIWAN,
              title: '中文',
              description: '中文描述',
            },
          ],
          imageUrlList: [
            `${IMAGE_DOMAIN}/brand-promotion-popups/2025-09-16/popup-01.jpg`,
          ],
        },
      ],
      noticeList: [
        {
          language: [
            { languageCode: LanguageCode.KOREAN, content: '공지 내용' },
            { languageCode: LanguageCode.ENGLISH, content: 'notice' },
            { languageCode: LanguageCode.TAIWAN, content: '通知' },
          ],
        },
      ],
      eventAndCouponList: [
        {
          event: {
            status: 'NORMAL',
            language: [
              { languageCode: LanguageCode.KOREAN, title: '이벤트 제목' },
              { languageCode: LanguageCode.ENGLISH, title: 'Event' },
              { languageCode: LanguageCode.TAIWAN, title: '活动' },
            ],
          },
          coupon: [
            {
              imageUrl: `${IMAGE_DOMAIN}/brand-promotion-event-coupons/2025-09-16/coupon-01.jpg`,
              language: [
                {
                  languageCode: LanguageCode.KOREAN,
                  title: '쿠폰 제목',
                  description: '쿠폰 설명',
                },
                {
                  languageCode: LanguageCode.ENGLISH,
                  title: 'Coupon',
                  description: 'Coupon desc',
                },
                {
                  languageCode: LanguageCode.TAIWAN,
                  title: '优惠券',
                  description: '优惠券描述',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  // -----------------------------------------------------------------------
  // PATCH /admin/brand/promotion/:id
  // -----------------------------------------------------------------------
  describe('PATCH /admin/brand/promotion/:id', () => {
    it('존재하지 않는 브랜드 프로모션 id로 요청하면 404를 반환한다', async () => {
      // Given - 유효한 promotion/brand만 존재
      const promotion = await createPromotion();
      const brand = await createBrand();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/99999999`)
        .send(buildPatchBody({ promotionId: promotion.id, brandId: brand.id }));

      // Then
      expect(res.status).toBe(404);
    });

    it('존재하지 않는 promotionId로 요청하면 404를 반환한다', async () => {
      // Given
      const promotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(promotion.id, brand.id);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(buildPatchBody({ promotionId: 99999999, brandId: brand.id }));

      // Then
      expect(res.status).toBe(404);
    });

    it('존재하지 않는 brandId로 요청하면 404를 반환한다', async () => {
      // Given
      const promotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(promotion.id, brand.id);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(buildPatchBody({ promotionId: promotion.id, brandId: 99999999 }));

      // Then
      expect(res.status).toBe(404);
    });

    it('기본 필드(promotionId, brandId, isActive)를 업데이트한다', async () => {
      // Given - 기존 브랜드 프로모션 + 변경할 프로모션 준비
      const oldPromotion = await createPromotion();
      const newPromotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(oldPromotion.id, brand.id, true);

      // When - 프로모션 교체 + isActive=false
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(
          buildPatchBody({
            promotionId: newPromotion.id,
            brandId: brand.id,
            isActive: false,
          }),
        );

      // Then
      expect(res.status).toBe(200);
      const row = await dataSource.query(
        `SELECT promotion_id, brand_id, is_active FROM brand_promotion WHERE id = $1`,
        [bp.id],
      );
      expect(row[0].promotion_id).toBe(newPromotion.id);
      expect(row[0].brand_id).toBe(brand.id);
      expect(row[0].is_active).toBe(false);
    });

    it('브랜드 설명 다국어(languageCode 기반)를 재등록한다', async () => {
      // Given
      const promotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(promotion.id, brand.id);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(buildPatchBody({ promotionId: promotion.id, brandId: brand.id }));

      // Then
      expect(res.status).toBe(200);
      const texts = await dataSource.query(
        `SELECT language_id, text_content FROM multilingual_text
         WHERE entity_type = 'brand_promotion' AND entity_id = $1
         AND field_name = 'description' ORDER BY language_id`,
        [bp.id],
      );
      expect(texts).toHaveLength(3);
      const byLang = Object.fromEntries(
        texts.map((t: { language_id: number; text_content: string }) => [
          t.language_id,
          t.text_content,
        ]),
      );
      expect(byLang[languageIds[LanguageCode.KOREAN]]).toBe('설명');
      expect(byLang[languageIds[LanguageCode.ENGLISH]]).toBe('DESCRIPTION');
      expect(byLang[languageIds[LanguageCode.TAIWAN]]).toBe('중국어중국어');
    });

    it('sub-resource(배너/섹션/팝업/공지/이벤트+쿠폰)를 전체 교체한다', async () => {
      // Given - 빈 브랜드 프로모션
      const promotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(promotion.id, brand.id);

      // When - 각 sub-resource 1개씩 포함된 body로 PATCH
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(buildPatchBody({ promotionId: promotion.id, brandId: brand.id }));

      // Then
      expect(res.status).toBe(200);

      // 배너: imageUrl → imagePath(IMAGE_DOMAIN 제거) 확인
      const banners = await dataSource.query(
        `SELECT id, link_url FROM brand_promotion_banner WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(banners).toHaveLength(1);
      expect(banners[0].link_url).toBe('https://example.com');

      const bannerImages = await dataSource.query(
        `SELECT image_path FROM brand_promotion_banner_image WHERE brand_promotion_banner_id = $1`,
        [banners[0].id],
      );
      expect(bannerImages).toHaveLength(2);
      bannerImages.forEach((img: { image_path: string }) => {
        expect(img.image_path).toContain('/brand-promotion-banners/');
      });

      // 배너 다국어: languageCode → languageId 변환 확인
      const bannerTexts = await dataSource.query(
        `SELECT language_id, text_content FROM multilingual_text
         WHERE entity_type = 'brand_promotion_banner' AND entity_id = $1
         AND field_name = 'title'`,
        [banners[0].id],
      );
      expect(bannerTexts).toHaveLength(3);

      // 섹션
      const sections = await dataSource.query(
        `SELECT id, type FROM brand_promotion_section WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('TYPE_1');
      const sectionImages = await dataSource.query(
        `SELECT image_path FROM brand_promotion_section_image WHERE brand_promotion_section_id = $1`,
        [sections[0].id],
      );
      expect(sectionImages).toHaveLength(2);

      // 팝업
      const popups = await dataSource.query(
        `SELECT id, place, is_active FROM brand_promotion_popup WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(popups).toHaveLength(1);
      expect(popups[0].place).toBe('장소');
      expect(popups[0].is_active).toBe(true);

      // 공지
      const notices = await dataSource.query(
        `SELECT id FROM brand_promotion_notice WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(notices).toHaveLength(1);

      // 이벤트 + 쿠폰
      const events = await dataSource.query(
        `SELECT id, status FROM brand_promotion_event WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('NORMAL');

      const coupons = await dataSource.query(
        `SELECT id, image_path FROM brand_promotion_event_coupon WHERE brand_promotion_event_id = $1`,
        [events[0].id],
      );
      expect(coupons).toHaveLength(1);
      expect(coupons[0].image_path).toContain(
        '/brand-promotion-event-coupons/',
      );
    });

    it('기존 sub-resource가 있을 때 PATCH하면 기존은 삭제되고 새 값으로 교체된다', async () => {
      // Given - 기존 banner가 있는 상태
      const promotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(promotion.id, brand.id);

      await dataSource.query(
        `INSERT INTO brand_promotion_banner (brand_promotion_id, link_url) VALUES ($1, 'https://old.example.com')`,
        [bp.id],
      );

      const oldBanners = await dataSource.query(
        `SELECT id FROM brand_promotion_banner WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(oldBanners).toHaveLength(1);
      const oldBannerId = oldBanners[0].id;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(buildPatchBody({ promotionId: promotion.id, brandId: brand.id }));

      // Then - 기존 배너는 삭제되고 새 배너가 생성됨
      expect(res.status).toBe(200);
      const newBanners = await dataSource.query(
        `SELECT id, link_url FROM brand_promotion_banner WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(newBanners).toHaveLength(1);
      expect(newBanners[0].id).not.toBe(oldBannerId);
      expect(newBanners[0].link_url).toBe('https://example.com');
    });

    it('noticeList와 eventAndCouponList를 생략하면 빈 상태로 업데이트된다', async () => {
      // Given
      const promotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(promotion.id, brand.id);
      const body = buildPatchBody({
        promotionId: promotion.id,
        brandId: brand.id,
      });
      delete (body as Record<string, unknown>).noticeList;
      delete (body as Record<string, unknown>).eventAndCouponList;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(body);

      // Then
      expect(res.status).toBe(200);
      const notices = await dataSource.query(
        `SELECT COUNT(*)::int AS cnt FROM brand_promotion_notice WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      const events = await dataSource.query(
        `SELECT COUNT(*)::int AS cnt FROM brand_promotion_event WHERE brand_promotion_id = $1`,
        [bp.id],
      );
      expect(notices[0].cnt).toBe(0);
      expect(events[0].cnt).toBe(0);
    });

    it('필수 필드(promotionId)가 누락되면 400을 반환한다', async () => {
      // Given
      const promotion = await createPromotion();
      const brand = await createBrand();
      const bp = await createBrandPromotion(promotion.id, brand.id);
      const body = buildPatchBody({
        promotionId: promotion.id,
        brandId: brand.id,
      });
      delete (body as Record<string, unknown>).promotionId;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bp.id}`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });
  });
});

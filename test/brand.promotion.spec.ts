import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { BrandPromotionPopupEntity } from '../libs/repository/src/entity/brand-promotion-popup.entity';
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
      'user_brand_like',
      'user_product_like',
      'user_sns',
      'user_fit',
      'user_profile',
      '"user"',
      'brand',
      'multilingual_text',
    ]);
  });

  async function signUpAndLogin(): Promise<{
    userId: number;
    oneTimeToken: string;
  }> {
    const body = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      nickname: faker.internet
        .username()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20),
    };

    const signupRes = await request(app.getHttpServer())
      .post('/user/auth/signup')
      .send(body);
    expect(signupRes.status).toBe(204);

    const loginRes = await request(app.getHttpServer())
      .post('/user/auth/login')
      .send({ email: body.email, password: body.password });
    expect(loginRes.status).toBe(200);

    const userRow = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );

    return {
      userId: userRow[0].id,
      oneTimeToken: loginRes.body.data.token as string,
    };
  }

  async function likeBrand(userId: number, brandId: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO user_brand_like (user_id, brand_id) VALUES ($1, $2)`,
      [userId, brandId],
    );
  }

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
  // GET /brand/promotion/v1/:brandPromotionId
  // -----------------------------------------------------------------------
  describe('GET /brand/promotion/v1/:brandPromotionId', () => {
    it('존재하지 않는 brandPromotionId로 조회 시 404를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get('/brand/promotion/v1/99999999')
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(404);
    });

    it('브랜드 프로모션 상세를 200과 함께 반환한다 (sub-resource 비어있음)', async () => {
      // Given - 프로모션 + 브랜드 + 브랜드 프로모션
      const promotion = await createPromotion();
      const brand = await createBrand();
      const brandPromotion = await createBrandPromotion(
        promotion.id,
        brand.id,
        true,
      );

      // When
      const res = await request(app.getHttpServer())
        .get(`/brand/promotion/v1/${brandPromotion.id}`)
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
        .get(`/brand/promotion/v1/${brandPromotion.id}`)
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
        .get(`/brand/promotion/v1/${brandPromotion.id}`)
        .set('Accept-language', LanguageCode.ENGLISH);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.brand.description).toBe('English description');
    });

    it('popupList는 startDate 오름차순으로 정렬되어 응답된다', async () => {
      // Given - 프로모션 + 브랜드 + 브랜드 프로모션
      const promotion = await createPromotion();
      const brand = await createBrand();
      const brandPromotion = await createBrandPromotion(
        promotion.id,
        brand.id,
        true,
      );

      // Given - 정렬되지 않은 순서로 팝업 3개 생성
      const popupRepo = dataSource.getRepository(BrandPromotionPopupEntity);
      const popupLate = await popupRepo.save({
        brandPromotionId: brandPromotion.id,
        place: 'late',
        address: 'late-addr',
        latitude: '0' as unknown as number,
        longitude: '0' as unknown as number,
        startDate: new Date('2025-05-01T00:00:00Z'),
        endDate: new Date('2025-05-31T00:00:00Z'),
        startTime: '10:00',
        endTime: '20:00',
        isActive: true,
      } as Partial<BrandPromotionPopupEntity>);
      const popupEarly = await popupRepo.save({
        brandPromotionId: brandPromotion.id,
        place: 'early',
        address: 'early-addr',
        latitude: '0' as unknown as number,
        longitude: '0' as unknown as number,
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-01-31T00:00:00Z'),
        startTime: '10:00',
        endTime: '20:00',
        isActive: true,
      } as Partial<BrandPromotionPopupEntity>);
      const popupMiddle = await popupRepo.save({
        brandPromotionId: brandPromotion.id,
        place: 'middle',
        address: 'middle-addr',
        latitude: '0' as unknown as number,
        longitude: '0' as unknown as number,
        startDate: new Date('2025-03-01T00:00:00Z'),
        endDate: new Date('2025-03-31T00:00:00Z'),
        startTime: '10:00',
        endTime: '20:00',
        isActive: true,
      } as Partial<BrandPromotionPopupEntity>);

      // When
      const res = await request(app.getHttpServer())
        .get(`/brand/promotion/v1/${brandPromotion.id}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then - startDate 오름차순: early → middle → late
      expect(res.status).toBe(200);
      expect(res.body.data.popupList).toHaveLength(3);

      const ids = res.body.data.popupList.map((p: { id: number }) => p.id);
      expect(ids).toEqual([popupEarly.id, popupMiddle.id, popupLate.id]);

      const startDates: string[] = res.body.data.popupList.map(
        (p: { startDate: string }) => p.startDate,
      );
      const sorted = [...startDates].sort((a, b) => a.localeCompare(b));
      expect(startDates).toEqual(sorted);
    });

    it('동일 brandId를 가진 다른 브랜드 프로모션을 brandPromotionId로 정확히 구분한다', async () => {
      // Given - 같은 brand에 두 개의 브랜드 프로모션 (서로 다른 promotion)
      const promotionA = await createPromotion();
      const promotionB = await createPromotion();
      const brand = await createBrand();
      const brandPromotionA = await createBrandPromotion(
        promotionA.id,
        brand.id,
        true,
      );
      const brandPromotionB = await createBrandPromotion(
        promotionB.id,
        brand.id,
        true,
      );

      // When - brandPromotionB 조회
      const res = await request(app.getHttpServer())
        .get(`/brand/promotion/v1/${brandPromotionB.id}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then - brandPromotionB가 속한 promotionB가 응답되어야 한다
      expect(res.status).toBe(200);
      expect(res.body.data.promotionId).toBe(promotionB.id);
      expect(res.body.data.promotionId).not.toBe(promotionA.id);
      expect(brandPromotionA.id).not.toBe(brandPromotionB.id);
    });

    describe('brand.isLiked 처리', () => {
      it('인증 없이 호출 시 brand.isLiked는 false다', async () => {
        // Given
        const promotion = await createPromotion();
        const brand = await createBrand();
        const brandPromotion = await createBrandPromotion(
          promotion.id,
          brand.id,
          true,
        );

        // When
        const res = await request(app.getHttpServer())
          .get(`/brand/promotion/v1/${brandPromotion.id}`)
          .set('Accept-language', LanguageCode.KOREAN);

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.brand.isLiked).toBe(false);
      });

      it('로그인했지만 해당 브랜드를 좋아요하지 않은 사용자는 brand.isLiked가 false다', async () => {
        // Given - 좋아요 없는 사용자
        const { oneTimeToken } = await signUpAndLogin();
        const promotion = await createPromotion();
        const brand = await createBrand();
        const brandPromotion = await createBrandPromotion(
          promotion.id,
          brand.id,
          true,
        );

        // When
        const res = await request(app.getHttpServer())
          .get(`/brand/promotion/v1/${brandPromotion.id}`)
          .set('Accept-language', LanguageCode.KOREAN)
          .set('Authorization', `Bearer ${oneTimeToken}`);

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.brand.isLiked).toBe(false);
      });

      it('해당 브랜드를 좋아요한 사용자는 brand.isLiked가 true다', async () => {
        // Given
        const { userId, oneTimeToken } = await signUpAndLogin();
        const promotion = await createPromotion();
        const brand = await createBrand();
        const brandPromotion = await createBrandPromotion(
          promotion.id,
          brand.id,
          true,
        );
        await likeBrand(userId, brand.id);

        // When
        const res = await request(app.getHttpServer())
          .get(`/brand/promotion/v1/${brandPromotion.id}`)
          .set('Accept-language', LanguageCode.KOREAN)
          .set('Authorization', `Bearer ${oneTimeToken}`);

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.brand.isLiked).toBe(true);
      });

      it('다른 사용자가 좋아요해도 요청자의 brand.isLiked는 영향받지 않는다', async () => {
        // Given - other 가 좋아요, me 는 좋아요 안함
        const other = await signUpAndLogin();
        const me = await signUpAndLogin();
        const promotion = await createPromotion();
        const brand = await createBrand();
        const brandPromotion = await createBrandPromotion(
          promotion.id,
          brand.id,
          true,
        );
        await likeBrand(other.userId, brand.id);

        // When
        const res = await request(app.getHttpServer())
          .get(`/brand/promotion/v1/${brandPromotion.id}`)
          .set('Accept-language', LanguageCode.KOREAN)
          .set('Authorization', `Bearer ${me.oneTimeToken}`);

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.brand.isLiked).toBe(false);
      });

      it('잘못된 토큰이면 익명으로 처리되어 brand.isLiked가 false다', async () => {
        // Given - 좋아요한 사용자가 있어도 토큰이 잘못되면 익명
        const { userId } = await signUpAndLogin();
        const promotion = await createPromotion();
        const brand = await createBrand();
        const brandPromotion = await createBrandPromotion(
          promotion.id,
          brand.id,
          true,
        );
        await likeBrand(userId, brand.id);

        // When
        const res = await request(app.getHttpServer())
          .get(`/brand/promotion/v1/${brandPromotion.id}`)
          .set('Accept-language', LanguageCode.KOREAN)
          .set('Authorization', 'Bearer not-a-real-token');

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.brand.isLiked).toBe(false);
      });
    });
  });
});

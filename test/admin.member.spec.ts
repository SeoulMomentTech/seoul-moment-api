import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { COLOR_OPTION_TYPE } from '@app/repository/enum/option.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { clearTokenCache, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const ADMIN_BASE = '/admin/member';
const USER_AUTH_BASE = '/user/auth';
const OPTION_VALUE_NAME_FIELD = 'value';

function randomNickname(): string {
  return faker.internet
    .username()
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);
}

interface SeededMember {
  userId: number;
  email: string;
  nickname: string;
}

interface SeededCatalog {
  brandId: number;
  productId: number;
  productItemId: number;
  productVariantId: number;
}

describe('AdminMemberController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;
  let adminToken: string;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    languageRepositoryService = app.get(LanguageRepositoryService);

    await ensureLanguages();

    // 다른 spec 이 admin 테이블을 비웠을 수 있어 캐시를 버리고 다시 받는다
    clearTokenCache();
    adminToken = await getAdminToken(app);
    await promoteAdminsToSuperAdmin();
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'cart_item',
      'order_item',
      '"order"',
      'user_brand_like',
      'user_product_like',
      'user_recent',
      'user_sns',
      'user_fit',
      'user_profile_image',
      'user_profile',
      '"user"',
      'variant_option',
      'product_variant',
      'product_item',
      'product',
      'option_value',
      '"option"',
      'brand',
      'category',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -------------------------------------------------------------------------
  // 헬퍼
  // -------------------------------------------------------------------------
  function adminGet(path: string) {
    return request(app.getHttpServer())
      .get(`${ADMIN_BASE}${path}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  function adminPatch(path: string) {
    return request(app.getHttpServer())
      .patch(`${ADMIN_BASE}${path}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  async function ensureLanguages(): Promise<void> {
    const rows = await dataSource.query(
      `SELECT COUNT(*)::int AS c FROM language`,
    );

    if (rows[0].c > 0) {
      return;
    }

    await dataSource.query(
      `INSERT INTO language (code, name, english_name, is_active, sort_order)
       VALUES ('ko', '한국어', 'Korean', true, 1),
              ('en', 'English', 'English', true, 2),
              ('zh-TW', '中文', 'Taiwan', true, 3)`,
    );
  }

  /** auth.helper 가 만든 테스트 관리자를 super_admin/NORMAL 로 승격한다. */
  async function promoteAdminsToSuperAdmin(): Promise<void> {
    await dataSource.query(
      `UPDATE admin
          SET role_id = (SELECT id FROM admin_role WHERE name = 'super_admin'),
              status = 'NORMAL'`,
    );
  }

  async function saveText(
    entityType: EntityType,
    entityId: number,
    field: string,
    ko: string,
  ): Promise<void> {
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      entityType,
      entityId,
      field,
      LanguageCode.KOREAN,
      ko,
    );
  }

  /** 가입 API 를 그대로 태워 회원 한 명을 만든다. */
  async function signUpMember(
    overrides?: Record<string, unknown>,
  ): Promise<SeededMember> {
    const body = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      nickname: randomNickname(),
      ...overrides,
    };

    const res = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/signup`)
      .send(body);
    expect(res.status).toBe(204);

    const [row] = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );

    return {
      userId: Number(row.id),
      email: body.email,
      nickname: body.nickname,
    };
  }

  async function linkSns(userId: number, provider: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO user_sns (user_id, provider, provider_user_id, provider_email)
       VALUES ($1, $2, $3, $4)`,
      [userId, provider, `${provider}-${userId}`, `sns-${userId}@test.com`],
    );
  }

  async function seedCatalog(): Promise<SeededCatalog> {
    const [category] = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    const [brand] = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, 'Seoul Moment')
       RETURNING id`,
      [category.id],
    );
    await saveText(EntityType.BRAND, brand.id, 'name', '서울모먼트');

    const [product] = await dataSource.query(
      `INSERT INTO product (status, brand_id, category_id) VALUES ('NORMAL', $1, $2)
       RETURNING id`,
      [brand.id, category.id],
    );
    await saveText(EntityType.PRODUCT, product.id, 'name', '오버사이즈 셔츠');

    const [item] = await dataSource.query(
      `INSERT INTO product_item (product_id, main_image_url, price, discount_price, status)
       VALUES ($1, '/product/item.png', 1000, 590, 'NORMAL') RETURNING id`,
      [product.id],
    );
    const [variant] = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, $2, 10, 'ACTIVE') RETURNING id`,
      [item.id, `SKU-${item.id}`],
    );

    const [option] = await dataSource.query(
      `INSERT INTO "option" (type, ui_type, sort_order, is_active)
       VALUES ($1, 'GRID', 1, true) RETURNING id`,
      [COLOR_OPTION_TYPE],
    );
    const [optionValue] = await dataSource.query(
      `INSERT INTO option_value (option_id, color_code, sort_order, is_active)
       VALUES ($1, '#FFFFFF', 1, true) RETURNING id`,
      [option.id],
    );
    await saveText(
      EntityType.OPTION_VALUE,
      optionValue.id,
      OPTION_VALUE_NAME_FIELD,
      'IVORY',
    );
    await dataSource.query(
      `INSERT INTO variant_option (variant_id, option_value_id) VALUES ($1, $2)`,
      [variant.id, optionValue.id],
    );

    return {
      brandId: brand.id,
      productId: product.id,
      productItemId: item.id,
      productVariantId: variant.id,
    };
  }

  async function seedOrder(
    userId: number,
    status: string,
    totalAmount: number,
  ): Promise<number> {
    const [order] = await dataSource.query(
      `INSERT INTO "order"
         (user_id, status, total_product_amount, shipping_fee_applied, total_amount)
       VALUES ($1, $2, $3, 60, $4) RETURNING id`,
      [userId, status, totalAmount - 60, totalAmount],
    );
    await dataSource.query(
      `UPDATE "order" SET order_number = $2 WHERE id = $1`,
      [order.id, `SM-20260908-${String(order.id).padStart(6, '0')}`],
    );

    return Number(order.id);
  }

  // -------------------------------------------------------------------------
  describe('GET /admin/member', () => {
    it('토큰이 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(ADMIN_BASE);

      // Then
      expect(res.status).toBe(401);
    });

    it('활성 회원만 내려주고 주문 집계를 함께 붙인다', async () => {
      // Given - 주문 3건: PAID 2건 + CANCELED 1건
      const member = await signUpMember();
      await seedOrder(member.userId, 'PAID', 1000);
      await seedOrder(member.userId, 'PAID', 2000);
      await seedOrder(member.userId, 'CANCELED', 500);

      // When
      const res = await adminGet('');

      // Then - orderCount 는 전체, paidAmount 는 PAID 만
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);

      const row = res.body.data.list[0];
      expect(row.id).toBe(member.userId);
      expect(row.orderCount).toBe(3);
      expect(row.paidAmount).toBe(3000);
      expect(row.lastOrderDate).not.toBeNull();
      expect(row.withdrawnAt).toBeNull();
      expect(row).not.toHaveProperty('password');
    });

    it('주문이 없는 회원은 0 집계로 내려온다', async () => {
      // Given
      await signUpMember();

      // When
      const res = await adminGet('');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list[0].orderCount).toBe(0);
      expect(res.body.data.list[0].paidAmount).toBe(0);
      expect(res.body.data.list[0].lastOrderDate).toBeNull();
    });

    it('SNS 연동이 없으면 provider 가 EMAIL 이고, 있으면 그 provider 다', async () => {
      // Given
      const emailMember = await signUpMember();
      const lineMember = await signUpMember();
      await linkSns(lineMember.userId, 'LINE');

      // When
      const emailRes = await adminGet('?provider=EMAIL');
      const lineRes = await adminGet('?provider=LINE');

      // Then
      expect(emailRes.body.data.total).toBe(1);
      expect(emailRes.body.data.list[0].id).toBe(emailMember.userId);
      expect(emailRes.body.data.list[0].provider).toBe('EMAIL');

      expect(lineRes.body.data.total).toBe(1);
      expect(lineRes.body.data.list[0].id).toBe(lineMember.userId);
      expect(lineRes.body.data.list[0].provider).toBe('LINE');
    });

    it('search 한 칸으로 이메일·닉네임을 함께 훑는다', async () => {
      // Given
      const member = await signUpMember({
        email: 'chen.yj@example.com',
        nickname: 'chen_yj',
      });
      await signUpMember({
        email: 'other@example.com',
        nickname: 'other_one',
      });

      // When - 이메일 조각으로 한 번, 닉네임 조각으로 한 번
      const byEmail = await adminGet('?search=chen.yj');
      const byNickname = await adminGet('?search=CHEN_YJ');

      // Then - ILIKE 라 대소문자를 가리지 않는다
      expect(byEmail.body.data.total).toBe(1);
      expect(byEmail.body.data.list[0].id).toBe(member.userId);
      expect(byNickname.body.data.total).toBe(1);
      expect(byNickname.body.data.list[0].id).toBe(member.userId);
    });

    it('기본 조회는 탈퇴 회원을 감추고 status=WITHDRAWN 일 때만 꺼낸다', async () => {
      // Given
      const active = await signUpMember();
      const withdrawn = await signUpMember();
      await dataSource.query(
        `UPDATE "user" SET delete_date = NOW() WHERE id = $1`,
        [withdrawn.userId],
      );

      // When
      const defaultRes = await adminGet('');
      const withdrawnRes = await adminGet('?status=WITHDRAWN');

      // Then
      expect(defaultRes.body.data.total).toBe(1);
      expect(defaultRes.body.data.list[0].id).toBe(active.userId);

      expect(withdrawnRes.body.data.total).toBe(1);
      expect(withdrawnRes.body.data.list[0].id).toBe(withdrawn.userId);
      expect(withdrawnRes.body.data.list[0].withdrawnAt).not.toBeNull();
    });

    it('adAgreed=false 는 미동의 회원만 걸러낸다', async () => {
      // Given - 가입 직후에는 셋 다 미동의(null)다
      const agreed = await signUpMember();
      const notAgreed = await signUpMember();
      await dataSource.query(
        `UPDATE "user" SET ad_agree_date = NOW() WHERE id = $1`,
        [agreed.userId],
      );

      // When
      const trueRes = await adminGet('?adAgreed=true');
      const falseRes = await adminGet('?adAgreed=false');

      // Then - 'false' 문자열이 true 로 뒤집히지 않아야 한다
      expect(trueRes.body.data.total).toBe(1);
      expect(trueRes.body.data.list[0].id).toBe(agreed.userId);
      expect(falseRes.body.data.total).toBe(1);
      expect(falseRes.body.data.list[0].id).toBe(notAgreed.userId);
    });

    it('joinedFrom 이 가입일보다 뒤면 결과가 비어 있다', async () => {
      // Given
      await signUpMember();

      // When
      const res = await adminGet('?joinedFrom=2099-01-01');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });

    it('joinedFrom 형식이 틀리면 400을 반환한다', async () => {
      // When
      const res = await adminGet('?joinedFrom=2026-8-1');

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /admin/member/summary', () => {
    it('summary 가 :userId 라우트에 먹히지 않고 집계를 반환한다', async () => {
      // Given
      await signUpMember();
      const lineMember = await signUpMember();
      await linkSns(lineMember.userId, 'LINE');

      const withdrawn = await signUpMember();
      await dataSource.query(
        `UPDATE "user" SET delete_date = NOW() WHERE id = $1`,
        [withdrawn.userId],
      );

      // When
      const res = await adminGet('/summary');

      // Then - 탈퇴 회원은 total 에서 빠지고 withdrawn 으로 센다
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.newIn7Days).toBe(2);
      expect(res.body.data.withdrawn).toBe(1);
      expect(res.body.data.byProvider.EMAIL).toBe(1);
      expect(res.body.data.byProvider.LINE).toBe(1);
      expect(res.body.data.byProvider.GOOGLE).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /admin/member/:userId', () => {
    it('프로필·체형·연동이 없으면 각 블록이 null 이다', async () => {
      // Given - 가입만 한 회원
      const member = await signUpMember();

      // When
      const res = await adminGet(`/${member.userId}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(member.userId);
      expect(res.body.data.sns).toBeNull();
      expect(res.body.data.fit).toBeNull();
      expect(res.body.data.agreement.termsOfServiceAgreeDate).toBeTruthy();
      expect(res.body.data.agreement.adAgreeDate).toBeNull();
    });

    it('프로필과 SNS 연동이 있으면 함께 내려준다', async () => {
      // Given
      const member = await signUpMember();
      await linkSns(member.userId, 'GOOGLE');
      await dataSource.query(
        `INSERT INTO user_profile (user_id, name, gender, birth_date, city, district)
         VALUES ($1, '陳雅婷', 'FEMALE', '1996-02-03', '臺北市', '信義區')`,
        [member.userId],
      );

      // When
      const res = await adminGet(`/${member.userId}`);

      // Then - 주소는 조각으로 내려온다
      expect(res.status).toBe(200);
      expect(res.body.data.sns.provider).toBe('GOOGLE');
      expect(res.body.data.profile.name).toBe('陳雅婷');
      expect(res.body.data.profile.city).toBe('臺北市');
      expect(res.body.data.profile.detailAddress).toBeNull();
    });

    it('없는 회원이면 404를 반환한다', async () => {
      // When
      const res = await adminGet('/999999');

      // Then
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('PATCH /admin/member/:userId/agreement', () => {
    it('boolean 을 받아 서버가 동의 일시를 채우고 비운다', async () => {
      // Given - 가입 직후 ad_agree_date 는 null
      const member = await signUpMember();

      // When - 광고 수신을 켠다
      const onRes = await adminPatch(`/${member.userId}/agreement`).send({
        ad: true,
      });

      // Then
      expect(onRes.status).toBe(204);

      const afterOn = await adminGet(`/${member.userId}`);
      expect(afterOn.body.data.agreement.adAgreeDate).not.toBeNull();

      // When - 다시 끈다
      const offRes = await adminPatch(`/${member.userId}/agreement`).send({
        ad: false,
      });

      // Then
      expect(offRes.status).toBe(204);

      const afterOff = await adminGet(`/${member.userId}`);
      expect(afterOff.body.data.agreement.adAgreeDate).toBeNull();
    });

    it('보낸 필드만 바꾸고 나머지는 건드리지 않는다', async () => {
      // Given - 신상품 알림만 켜둔 상태
      const member = await signUpMember();
      await adminPatch(`/${member.userId}/agreement`).send({
        newProduct: true,
        recommend: true,
      });

      // When - 광고만 켠다
      const res = await adminPatch(`/${member.userId}/agreement`).send({
        ad: true,
      });

      // Then
      expect(res.status).toBe(204);

      const detail = await adminGet(`/${member.userId}`);
      expect(detail.body.data.agreement.newProductDate).not.toBeNull();
      expect(detail.body.data.agreement.recommendDate).not.toBeNull();
      expect(detail.body.data.agreement.adAgreeDate).not.toBeNull();
    });

    it('약관 동의 일시는 변경 대상이 아니다', async () => {
      // Given
      const member = await signUpMember();
      const before = await adminGet(`/${member.userId}`);

      // When
      await adminPatch(`/${member.userId}/agreement`).send({ ad: true });

      // Then - 가입 시점 기록은 그대로다
      const after = await adminGet(`/${member.userId}`);
      expect(after.body.data.agreement.termsOfServiceAgreeDate).toBe(
        before.body.data.agreement.termsOfServiceAgreeDate,
      );
      expect(after.body.data.agreement.privacyPolicyAgreeDate).toBe(
        before.body.data.agreement.privacyPolicyAgreeDate,
      );
    });

    it('빈 body 면 400을 반환한다', async () => {
      // Given
      const member = await signUpMember();

      // When
      const res = await adminPatch(`/${member.userId}/agreement`).send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('없는 회원이면 404를 반환한다', async () => {
      // When
      const res = await adminPatch('/999999/agreement').send({ ad: true });

      // Then
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /admin/member/:userId/order', () => {
    it('취소 주문도 함께 내리고 status 로 걸러낼 수 있다', async () => {
      // Given
      const member = await signUpMember();
      await seedOrder(member.userId, 'PAID', 2310);
      await seedOrder(member.userId, 'CANCELED', 1180);

      // When
      const allRes = await adminGet(`/${member.userId}/order`);
      const paidRes = await adminGet(`/${member.userId}/order?status=PAID`);

      // Then
      expect(allRes.status).toBe(200);
      expect(allRes.body.data.total).toBe(2);

      expect(paidRes.body.data.total).toBe(1);
      expect(paidRes.body.data.list[0].status).toBe('PAID');
      expect(paidRes.body.data.list[0].totalAmount).toBe(2310);
      expect(paidRes.body.data.list[0].shippingFeeApplied).toBe(60);
      expect(paidRes.body.data.list[0].orderNumber).toMatch(/^SM-/);
    });

    it('없는 회원이면 404를 반환한다', async () => {
      // When
      const res = await adminGet('/999999/order');

      // Then
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /admin/member/:userId/cart', () => {
    it('상품명·옵션 텍스트를 채워 페이징 없이 전부 내린다', async () => {
      // Given
      const member = await signUpMember();
      const catalog = await seedCatalog();
      await dataSource.query(
        `INSERT INTO cart_item (user_id, product_variant_id, quantity)
         VALUES ($1, $2, 2)`,
        [member.userId, catalog.productVariantId],
      );

      // When
      const res = await adminGet(`/${member.userId}/cart`);

      // Then - 가격은 할인가가 우선한다
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);

      const line = res.body.data.list[0];
      expect(line.quantity).toBe(2);
      expect(line.productName).toBe('오버사이즈 셔츠');
      expect(line.optionText).toBe('IVORY');
      expect(line.price).toBe(590);
      expect(line.isAvailable).toBe(true);
    });

    it('담긴 뒤 상품이 내려가면 isAvailable 이 false 다', async () => {
      // Given
      const member = await signUpMember();
      const catalog = await seedCatalog();
      await dataSource.query(
        `INSERT INTO cart_item (user_id, product_variant_id, quantity)
         VALUES ($1, $2, 1)`,
        [member.userId, catalog.productVariantId],
      );
      await dataSource.query(
        `UPDATE product_item SET status = 'BLOCK' WHERE id = $1`,
        [catalog.productItemId],
      );

      // When
      const res = await adminGet(`/${member.userId}/cart`);

      // Then
      expect(res.body.data.list[0].isAvailable).toBe(false);
    });

    it('장바구니가 비어 있으면 빈 목록이다', async () => {
      // Given
      const member = await signUpMember();

      // When
      const res = await adminGet(`/${member.userId}/cart`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.list).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /admin/member/:userId/like', () => {
    it('상품·브랜드 좋아요를 한 목록으로 섞어 최신순으로 내린다', async () => {
      // Given
      const member = await signUpMember();
      const catalog = await seedCatalog();
      await dataSource.query(
        `INSERT INTO user_product_like (user_id, product_item_id, create_date)
         VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
        [member.userId, catalog.productItemId],
      );
      await dataSource.query(
        `INSERT INTO user_brand_like (user_id, brand_id, create_date)
         VALUES ($1, $2, NOW())`,
        [member.userId, catalog.brandId],
      );

      // When
      const res = await adminGet(`/${member.userId}/like`);

      // Then - UNION 결과가 create_date DESC 로 정렬된다
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.list[0].type).toBe('BRAND');
      expect(res.body.data.list[0].targetId).toBe(catalog.brandId);
      expect(res.body.data.list[0].name).toBe('서울모먼트');
      expect(res.body.data.list[0].imageUrl).toBeNull();

      expect(res.body.data.list[1].type).toBe('PRODUCT');
      expect(res.body.data.list[1].targetId).toBe(catalog.productItemId);
      expect(res.body.data.list[1].name).toBe('오버사이즈 셔츠');
      expect(res.body.data.list[1].imageUrl).toContain('/product/item.png');
    });

    it('type 으로 한 종류만 걸러낼 수 있다', async () => {
      // Given
      const member = await signUpMember();
      const catalog = await seedCatalog();
      await dataSource.query(
        `INSERT INTO user_product_like (user_id, product_item_id) VALUES ($1, $2)`,
        [member.userId, catalog.productItemId],
      );
      await dataSource.query(
        `INSERT INTO user_brand_like (user_id, brand_id) VALUES ($1, $2)`,
        [member.userId, catalog.brandId],
      );

      // When
      const res = await adminGet(`/${member.userId}/like?type=BRAND`);

      // Then
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.list[0].type).toBe('BRAND');
    });

    it('페이지네이션이 두 테이블에 걸쳐 동작한다', async () => {
      // Given - 상품 1건 + 브랜드 1건
      const member = await signUpMember();
      const catalog = await seedCatalog();
      await dataSource.query(
        `INSERT INTO user_product_like (user_id, product_item_id, create_date)
         VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
        [member.userId, catalog.productItemId],
      );
      await dataSource.query(
        `INSERT INTO user_brand_like (user_id, brand_id, create_date)
         VALUES ($1, $2, NOW())`,
        [member.userId, catalog.brandId],
      );

      // When
      const page2 = await adminGet(`/${member.userId}/like?page=2&count=1`);

      // Then - total 은 합계, 2페이지에는 오래된 쪽이 온다
      expect(page2.body.data.total).toBe(2);
      expect(page2.body.data.list).toHaveLength(1);
      expect(page2.body.data.list[0].type).toBe('PRODUCT');
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /admin/member/:userId/recent', () => {
    it('최근 본 상품에 상품명과 이미지를 채워 내린다', async () => {
      // Given
      const member = await signUpMember();
      const catalog = await seedCatalog();
      await dataSource.query(
        `INSERT INTO user_recent (user_id, product_item_id) VALUES ($1, $2)`,
        [member.userId, catalog.productItemId],
      );

      // When
      const res = await adminGet(`/${member.userId}/recent`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.list[0].productItemId).toBe(catalog.productItemId);
      expect(res.body.data.list[0].name).toBe('오버사이즈 셔츠');
      expect(res.body.data.list[0].imageUrl).toContain('/product/item.png');
    });

    it('없는 회원이면 404를 반환한다', async () => {
      // When
      const res = await adminGet('/999999/recent');

      // Then
      expect(res.status).toBe(404);
    });
  });
});

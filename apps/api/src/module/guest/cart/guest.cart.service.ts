import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { CartItemEntity } from '@app/repository/entity/cart-item.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { ShippingRepositoryService } from '@app/repository/service/shipping.repository.service';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  GetGuestCartResponse,
  GuestCartLineDto,
  PostGuestCartItemResponse,
  PostGuestCartRequest,
  PostGuestCartResponse,
} from './guest.cart.dto';
import {
  CartAmountCalculator,
  CartLineAmountDto,
} from '../../user/cart/cart.calculator';
import { UserCartService } from '../../user/cart/user.cart.service';

/** 심사 기간 동안만 유지하면 되는 값이라 짧게 둔다 */
const GUEST_CART_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * 게스트(비로그인) 장바구니.
 *
 * 심사용 임시 기능이라 DB 테이블을 만들지 않고 Redis 에만 담는다.
 * 지울 때 마이그레이션이 필요 없고, 키가 TTL 로 알아서 사라진다.
 *
 * 금액·배송비·브랜드 묶음은 회원 장바구니와 같은 계산기를 그대로 쓴다.
 * 규칙이 두 벌이 되면 화면 숫자가 갈린다.
 */
@Injectable()
export class GuestCartService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly shippingRepositoryService: ShippingRepositoryService,
    private readonly userCartService: UserCartService,
    private readonly cartAmountCalculator: CartAmountCalculator,
  ) {}

  /**
   * 담기. 게스트 ID 가 없으면 여기서 발급한다 — 담기 전에는 장바구니가
   * 존재하지 않으므로 별도의 "게스트 발급" API 를 두지 않는다.
   */
  async addItems(
    guestId: string | undefined,
    dto: PostGuestCartRequest,
  ): Promise<PostGuestCartResponse> {
    const id = guestId?.trim() || randomUUID();
    const requested = this.mergeRequestedQuantities(dto.items);
    const stored = await this.readLines(id);

    const merged = new Map(
      stored.map((line) => [line.productVariantId, line.quantity]),
    );

    for (const [variantId, quantity] of requested) {
      merged.set(variantId, (merged.get(variantId) ?? 0) + quantity);
    }

    await this.assertStocks(merged);

    const lines = Array.from(merged, ([productVariantId, quantity]) =>
      GuestCartLineDto.from(productVariantId, quantity),
    );

    await this.writeLines(id, lines);

    const byVariant = new Map(
      lines.map((line) => [line.productVariantId, line]),
    );

    return PostGuestCartResponse.from(
      id,
      Array.from(requested.keys()).map((variantId) =>
        PostGuestCartItemResponse.from(
          byVariant.get(variantId) ?? GuestCartLineDto.from(variantId, 0),
        ),
      ),
      lines.length,
    );
  }

  async getCart(
    guestId: string,
    language: LanguageCode,
  ): Promise<GetGuestCartResponse> {
    const stored = await this.readLines(guestId);
    const lines = await this.toAmountLines(stored);
    const policy = await this.shippingRepositoryService.getPolicy();

    // 배송지를 모르므로 본섬 기준이다. 게스트는 주문까지 가지 않는다.
    const amount = this.cartAmountCalculator.calculateAmount(
      lines,
      policy,
      false,
    );

    const texts = await this.userCartService.loadTexts(lines, language);
    const groups = this.userCartService.buildBrandGroups(lines, texts);

    return GetGuestCartResponse.from(
      groups,
      amount,
      policy.remoteIslandFee,
      stored.length,
    );
  }

  async getCount(guestId: string): Promise<number> {
    return (await this.readLines(guestId)).length;
  }

  async updateQuantity(
    guestId: string,
    productVariantId: number,
    quantity: number,
  ): Promise<void> {
    const lines = await this.readLines(guestId);
    const target = lines.find(
      (line) => line.productVariantId === productVariantId,
    );

    if (!target) {
      throw new ServiceError(
        `No exist guest cart item. productVariantId: ${productVariantId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    await this.assertStocks(new Map([[productVariantId, quantity]]));

    target.quantity = quantity;

    await this.writeLines(guestId, lines);
  }

  async deleteItem(guestId: string, productVariantId: number): Promise<void> {
    const lines = await this.readLines(guestId);
    const remain = lines.filter(
      (line) => line.productVariantId !== productVariantId,
    );

    if (remain.length === lines.length) {
      throw new ServiceError(
        `No exist guest cart item. productVariantId: ${productVariantId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    await this.writeLines(guestId, remain);
  }

  async clear(guestId: string): Promise<void> {
    await this.cacheService.del(this.cacheKey(guestId));
  }

  /** 같은 SKU 가 여러 줄로 들어와도 한 라인으로 합친다. 첫 등장 순서를 지킨다 */
  private mergeRequestedQuantities(
    items: PostGuestCartRequest['items'],
  ): Map<number, number> {
    const merged = new Map<number, number>();

    for (const item of items) {
      merged.set(
        item.productVariantId,
        (merged.get(item.productVariantId) ?? 0) + item.quantity,
      );
    }

    return merged;
  }

  /**
   * 없는 SKU 와 재고 부족을 한자리에서 막는다.
   * 회원 장바구니와 같은 에러 모양을 쓴다 — 화면이 분기하지 않아도 되게.
   */
  private async assertStocks(quantities: Map<number, number>): Promise<void> {
    const variantIds = Array.from(quantities.keys());
    const variants =
      await this.productRepositoryService.getProductVariantsByIds(variantIds);
    const stocks = new Map(
      variants.map((variant) => [variant.id, variant.stockQuantity]),
    );
    const missing = variantIds.filter((id) => !stocks.has(id));

    if (missing.length > 0) {
      throw new ServiceError(
        `No exist product variant ID: ${missing.join(', ')}`,
        ServiceErrorCode.NOT_FOUND_DATA,
        { productVariantIds: missing },
      );
    }

    for (const [variantId, quantity] of quantities) {
      const available = stocks.get(variantId) ?? 0;

      if (available < quantity) {
        throw new ServiceError(
          `Not enough stock. productVariantId: ${variantId}, available: ${available}, requested: ${quantity}`,
          ServiceErrorCode.CONFLICT,
          { productVariantId: variantId, available, requested: quantity },
        );
      }
    }
  }

  /**
   * 저장해 둔 SKU·수량을 회원 장바구니와 같은 계산 단위로 바꾼다.
   * DB 에 없는 임시 엔티티라 id 가 없고, 그래서 응답의 cartItemId 는 null 이다.
   */
  private async toAmountLines(
    stored: GuestCartLineDto[],
  ): Promise<CartLineAmountDto[]> {
    if (stored.length === 0) {
      return [];
    }

    const variants =
      await this.productRepositoryService.findVariantDetailListByIds(
        stored.map((line) => line.productVariantId),
      );
    const byId = new Map(variants.map((variant) => [variant.id, variant]));

    const cartItems = stored
      .filter((line) => byId.has(line.productVariantId))
      .map((line) =>
        // plainToInstance 는 중첩 엔티티의 메서드를 잃는다. 조회한 인스턴스를 그대로 붙인다.
        Object.assign(new CartItemEntity(), {
          productVariantId: line.productVariantId,
          quantity: line.quantity,
          productVariant: byId.get(line.productVariantId),
        }),
      );

    return this.cartAmountCalculator.toLines(cartItems);
  }

  private async readLines(guestId: string): Promise<GuestCartLineDto[]> {
    const raw = await this.cacheService.find(this.cacheKey(guestId));

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as GuestCartLineDto[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // 형식이 깨진 값은 빈 장바구니로 본다. 심사용이라 복구할 것이 없다.
      return [];
    }
  }

  private async writeLines(
    guestId: string,
    lines: GuestCartLineDto[],
  ): Promise<void> {
    if (lines.length === 0) {
      await this.cacheService.del(this.cacheKey(guestId));

      return;
    }

    await this.cacheService.set(
      this.cacheKey(guestId),
      JSON.stringify(lines),
      GUEST_CART_TTL_SECONDS,
    );
  }

  private cacheKey(guestId: string): string {
    return `${RedisKey.GUEST_CART}:${guestId}`;
  }
}

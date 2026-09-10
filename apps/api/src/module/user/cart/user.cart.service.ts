import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { CartItemEntity } from '@app/repository/entity/cart-item.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { CartRepositoryService } from '@app/repository/service/cart.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { ShippingRepositoryService } from '@app/repository/service/shipping.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import { CartAmountCalculator, CartLineAmountDto } from './cart.calculator';
import {
  CartTextBundleDto,
  GetUserCartBrandGroupResponse,
  GetUserCartResponse,
  PostUserCartItemResponse,
  PostUserCartRequest,
  PostUserCartResponse,
} from './user.cart.dto';

@Injectable()
export class UserCartService {
  constructor(
    private readonly cartRepositoryService: CartRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly shippingRepositoryService: ShippingRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly cartAmountCalculator: CartAmountCalculator,
  ) {}

  /**
   * 단건·다건을 한 경로로 받는다. 상품상세에서 옵션 조합을 여러 개 골라
   * 한 번에 담는 화면이 있어 items 는 항상 배열이다.
   *
   * 같은 SKU 를 다시 담으면 라인을 늘리지 않고 수량을 더한다.
   * (user_id, product_variant_id) UNIQUE 제약과 짝이 되는 동작이다.
   *
   * 하나라도 담을 수 없으면 전부 담지 않는다. 절반만 담기면 화면의
   * 선택 패널이 어떤 상태여야 하는지가 애매해진다.
   */
  @Transactional()
  async createCartItems(
    userId: number,
    dto: PostUserCartRequest,
  ): Promise<PostUserCartResponse> {
    const requested = this.mergeRequestedQuantities(dto.items);
    const variantIds = Array.from(requested.keys());

    const stocks = await this.loadStocks(variantIds);
    const exists = await this.cartRepositoryService.findByUserIdAndVariantIds(
      userId,
      variantIds,
    );
    const existMap = new Map(
      exists.map((cartItem) => [cartItem.productVariantId, cartItem]),
    );

    const entities = variantIds.map((variantId) => {
      const quantity =
        (existMap.get(variantId)?.quantity ?? 0) +
        (requested.get(variantId) ?? 0);

      this.assertStock(variantId, stocks.get(variantId) ?? 0, quantity);

      return plainToInstance(CartItemEntity, {
        ...(existMap.has(variantId) ? { id: existMap.get(variantId)?.id } : {}),
        userId,
        productVariantId: variantId,
        quantity,
      });
    });

    const saved = await this.cartRepositoryService.saveMany(entities);
    const savedMap = new Map(
      saved.map((cartItem) => [cartItem.productVariantId, cartItem]),
    );
    const totalCount = await this.cartRepositoryService.countByUserId(userId);

    return PostUserCartResponse.from(
      variantIds.map((variantId) =>
        PostUserCartItemResponse.from(
          variantId,
          savedMap.get(variantId)?.id ?? 0,
          savedMap.get(variantId)?.quantity ?? 0,
        ),
      ),
      totalCount,
    );
  }

  /** 같은 SKU 가 여러 줄로 들어와도 한 라인으로 합친다. 첫 등장 순서를 지킨다 */
  private mergeRequestedQuantities(
    items: PostUserCartRequest['items'],
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

  /** 없는 SKU 가 하나라도 있으면 담기 전에 끊는다 */
  private async loadStocks(variantIds: number[]): Promise<Map<number, number>> {
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

    return stocks;
  }

  async getCart(
    userId: number,
    language: LanguageCode,
  ): Promise<GetUserCartResponse> {
    const cartItems =
      await this.cartRepositoryService.findDetailListByUserId(userId);

    const lines = this.cartAmountCalculator.toLines(cartItems);
    const policy = await this.shippingRepositoryService.getPolicy();

    // 장바구니 단계에서는 배송지를 모른다. 본섬 기준으로 보여주고
    // 확정은 주문서(preview)에서 한다.
    const amount = this.cartAmountCalculator.calculateAmount(
      lines,
      policy,
      false,
    );

    const texts = await this.loadTexts(lines, language);
    const groups = this.buildBrandGroups(lines, texts);

    return GetUserCartResponse.from(
      groups,
      amount,
      policy.remoteIslandFee,
      cartItems.length,
    );
  }

  @Transactional()
  async updateQuantity(userId: number, id: number, quantity: number) {
    const cartItem = await this.cartRepositoryService.findByIdAndUserId(
      id,
      userId,
    );

    if (!cartItem) {
      throw new ServiceError(
        `No exist cart item ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const variant =
      await this.productRepositoryService.findProductVariantDetailById(
        cartItem.productVariantId,
      );

    this.assertStock(
      cartItem.productVariantId,
      variant?.stockQuantity ?? 0,
      quantity,
    );

    cartItem.quantity = quantity;

    await this.cartRepositoryService.save(cartItem);
  }

  @Transactional()
  async deleteCartItems(userId: number, ids?: number[]) {
    if (!ids || ids.length === 0) {
      await this.cartRepositoryService.deleteAllByUserId(userId);
      return;
    }

    await this.cartRepositoryService.deleteByIds(userId, ids);
  }

  @Transactional()
  async deleteCartItem(userId: number, id: number) {
    const cartItem = await this.cartRepositoryService.findByIdAndUserId(
      id,
      userId,
    );

    if (!cartItem) {
      throw new ServiceError(
        `No exist cart item ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    await this.cartRepositoryService.deleteByIds(userId, [id]);
  }

  async getCount(userId: number): Promise<number> {
    return this.cartRepositoryService.countByUserId(userId);
  }

  /** 브랜드명·상품명·옵션 텍스트는 전부 multilingual_text 에 있어 한 번에 모아 온다 */
  async loadTexts(
    lines: CartLineAmountDto[],
    language: LanguageCode,
  ): Promise<CartTextBundleDto> {
    if (lines.length === 0) {
      return CartTextBundleDto.from([], [], []);
    }

    const brandIds = this.collectIds(
      lines,
      (line) =>
        line.cartItem.productVariant?.productItem?.product?.brand?.id ?? null,
    );
    const productIds = this.collectIds(
      lines,
      (line) => line.cartItem.productVariant?.productItem?.product?.id ?? null,
    );
    const optionValueIds = Array.from(
      new Set(
        lines.flatMap((line) =>
          (line.cartItem.productVariant?.variantOptions ?? []).map(
            (variantOption) => variantOption.optionValueId,
          ),
        ),
      ),
    );

    const [brandTexts, productTexts, optionValueTexts] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND,
        brandIds,
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT,
        productIds,
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.OPTION_VALUE,
        optionValueIds,
        language,
      ),
    ]);

    return CartTextBundleDto.from(brandTexts, productTexts, optionValueTexts);
  }

  buildBrandGroups(
    lines: CartLineAmountDto[],
    texts: CartTextBundleDto,
  ): GetUserCartBrandGroupResponse[] {
    return this.cartAmountCalculator
      .groupByBrand(lines)
      .map((group) => GetUserCartBrandGroupResponse.from(group, texts));
  }

  private collectIds(
    lines: CartLineAmountDto[],
    pick: (line: CartLineAmountDto) => number | null,
  ): number[] {
    return Array.from(
      new Set(
        lines
          .map(pick)
          .filter((id): id is number => typeof id === 'number' && id > 0),
      ),
    );
  }

  /**
   * 여러 건을 한 번에 담을 때 화면이 어느 줄을 빨갛게 칠할지 알아야 하므로
   * 어떤 SKU 가 몇 개 남았는지를 응답 data 에 실어 보낸다.
   */
  private assertStock(
    productVariantId: number,
    stockQuantity: number,
    requestedQuantity: number,
  ) {
    if (stockQuantity < requestedQuantity) {
      throw new ServiceError(
        `Not enough stock. productVariantId: ${productVariantId}, available: ${stockQuantity}, requested: ${requestedQuantity}`,
        ServiceErrorCode.CONFLICT,
        {
          productVariantId,
          available: stockQuantity,
          requested: requestedQuantity,
        },
      );
    }
  }
}

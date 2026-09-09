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
   * 같은 SKU 를 다시 담으면 라인을 늘리지 않고 수량을 더한다.
   * (user_id, product_variant_id) UNIQUE 제약과 짝이 되는 동작이다.
   */
  @Transactional()
  async createCartItem(
    userId: number,
    dto: PostUserCartRequest,
  ): Promise<PostUserCartResponse> {
    const variant =
      await this.productRepositoryService.findProductVariantDetailById(
        dto.productVariantId,
      );

    if (!variant) {
      throw new ServiceError(
        `No exist product variant ID: ${dto.productVariantId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const exist = await this.cartRepositoryService.findByUserIdAndVariantId(
      userId,
      dto.productVariantId,
    );

    const nextQuantity = (exist?.quantity ?? 0) + dto.quantity;

    this.assertStock(variant.stockQuantity, nextQuantity);

    const saved = await this.cartRepositoryService.save(
      plainToInstance(CartItemEntity, {
        ...(exist ? { id: exist.id } : {}),
        userId,
        productVariantId: dto.productVariantId,
        quantity: nextQuantity,
      }),
    );

    const totalCount = await this.cartRepositoryService.countByUserId(userId);

    return PostUserCartResponse.from(saved.id, totalCount);
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

    this.assertStock(variant?.stockQuantity ?? 0, quantity);

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

  private assertStock(stockQuantity: number, requestedQuantity: number) {
    if (stockQuantity < requestedQuantity) {
      throw new ServiceError(
        `Not enough stock. available: ${stockQuantity}, requested: ${requestedQuantity}`,
        ServiceErrorCode.CONFLICT,
      );
    }
  }
}

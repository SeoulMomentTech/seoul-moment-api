import { CartItemEntity } from '@app/repository/entity/cart-item.entity';
import { ShippingPolicyEntity } from '@app/repository/entity/shipping-policy.entity';
import { ShippingRemoteAreaEntity } from '@app/repository/entity/shipping-remote-area.entity';
import {
  ProductItemStatus,
  ProductVariantStatus,
} from '@app/repository/enum/product.enum';
import { Injectable } from '@nestjs/common';

/**
 * 장바구니 한 라인의 판매 가능 여부와 금액.
 * 화면 표현(이름·이미지)은 DTO 가 맡고, 여기서는 숫자와 상태만 본다.
 */
export class CartLineAmountDto {
  cartItem: CartItemEntity;
  isSoldOut: boolean;
  isAvailable: boolean;
  unitPrice: number;
  unitDiscountPrice: number;
  totalPrice: number;

  static from(cartItem: CartItemEntity): CartLineAmountDto {
    const variant = cartItem.productVariant;
    const productItem = variant?.productItem;

    const stockQuantity = variant?.stockQuantity ?? 0;
    const isSoldOut = stockQuantity <= 0;

    const isSellable =
      !!productItem &&
      variant?.status === ProductVariantStatus.ACTIVE &&
      productItem.status === ProductItemStatus.NORMAL;

    const unitDiscountPrice = productItem?.getEffectivePrice() ?? 0;

    const dto = new CartLineAmountDto();
    dto.cartItem = cartItem;
    dto.isSoldOut = isSoldOut;
    dto.isAvailable = isSellable && !isSoldOut;
    dto.unitPrice = productItem?.price ?? 0;
    dto.unitDiscountPrice = unitDiscountPrice;
    dto.totalPrice = unitDiscountPrice * cartItem.quantity;

    return dto;
  }

  getStockQuantity(): number {
    return this.cartItem.productVariant?.stockQuantity ?? 0;
  }

  /** 주문 시점 재고 검증 — 담긴 수량만큼 남아 있어야 한다 */
  hasEnoughStock(): boolean {
    return (
      this.isAvailable && this.getStockQuantity() >= this.cartItem.quantity
    );
  }
}

/** 브랜드 묶음. 배송비는 브랜드와 무관하므로 표시용 그룹일 뿐이다 */
export class CartBrandGroupDto {
  brandId: number;
  lines: CartLineAmountDto[];
  productAmount: number;

  static from(brandId: number, lines: CartLineAmountDto[]): CartBrandGroupDto {
    const dto = new CartBrandGroupDto();
    dto.brandId = brandId;
    dto.lines = lines;
    dto.productAmount = lines
      .filter((line) => line.isAvailable)
      .reduce((sum, line) => sum + line.totalPrice, 0);

    return dto;
  }
}

/** 금액 요약. 배송비 규칙이 바뀌어도 이 값들의 의미는 그대로다 */
export class CartAmountDto {
  totalProductAmount: number;
  shippingFee: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  isRemoteIsland: boolean;
  totalAmount: number;

  static from(
    totalProductAmount: number,
    shippingFee: number,
    freeShippingThreshold: number,
    isRemoteIsland: boolean,
  ): CartAmountDto {
    const dto = new CartAmountDto();
    dto.totalProductAmount = totalProductAmount;
    dto.shippingFee = shippingFee;
    dto.freeShippingThreshold = freeShippingThreshold;
    dto.amountToFreeShipping = Math.max(
      freeShippingThreshold - totalProductAmount,
      0,
    );
    dto.isRemoteIsland = isRemoteIsland;
    dto.totalAmount = totalProductAmount + shippingFee;

    return dto;
  }
}

@Injectable()
export class ShippingFeeCalculator {
  /**
   * 프론트가 보내는 縣市 표기가 `臺東縣` 과 `台東縣` 로 갈릴 수 있다.
   * 표기가 어긋나면 외섬 판정이 조용히 실패해 요금을 덜 받게 되므로
   * 비교 전에 한쪽으로 모은다.
   */
  private normalize(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/台/g, '臺');
  }

  isRemoteIsland(
    areas: ShippingRemoteAreaEntity[],
    city: string,
    district: string,
  ): boolean {
    const normalizedCity = this.normalize(city);
    const normalizedDistrict = this.normalize(district);

    if (!normalizedCity) {
      return false;
    }

    return areas.some((area) => {
      if (this.normalize(area.city) !== normalizedCity) {
        return false;
      }

      // district 가 null 이면 그 縣 전체가 외섬이다
      if (area.district === null || area.district === undefined) {
        return true;
      }

      return this.normalize(area.district) === normalizedDistrict;
    });
  }

  calculate(
    policy: ShippingPolicyEntity,
    productAmount: number,
    isRemoteIsland: boolean,
  ): number {
    return policy.calculateShippingFee(productAmount, isRemoteIsland);
  }
}

@Injectable()
export class CartAmountCalculator {
  constructor(private readonly shippingFeeCalculator: ShippingFeeCalculator) {}

  toLines(cartItems: CartItemEntity[]): CartLineAmountDto[] {
    return cartItems.map((cartItem) => CartLineAmountDto.from(cartItem));
  }

  /**
   * 브랜드로 묶는다. product_item 에 brand_id 가 없어 product 를 한 단계
   * 더 타고 들어가야 한다.
   */
  groupByBrand(lines: CartLineAmountDto[]): CartBrandGroupDto[] {
    const order: number[] = [];
    const buckets = new Map<number, CartLineAmountDto[]>();

    for (const line of lines) {
      const brandId =
        line.cartItem.productVariant?.productItem?.product?.brand?.id ?? 0;

      if (!buckets.has(brandId)) {
        buckets.set(brandId, []);
        order.push(brandId);
      }

      buckets.get(brandId).push(line);
    }

    return order.map((brandId) =>
      CartBrandGroupDto.from(brandId, buckets.get(brandId)),
    );
  }

  /**
   * 품절·판매중지 라인은 금액에서 뺀다. 살 수 없는 것을 합계에 넣으면
   * 무료배송까지 남은 금액이 틀리게 나온다.
   */
  sumProductAmount(lines: CartLineAmountDto[]): number {
    return lines
      .filter((line) => line.isAvailable)
      .reduce((sum, line) => sum + line.totalPrice, 0);
  }

  calculateAmount(
    lines: CartLineAmountDto[],
    policy: ShippingPolicyEntity,
    isRemoteIsland: boolean,
  ): CartAmountDto {
    const totalProductAmount = this.sumProductAmount(lines);
    const shippingFee = this.shippingFeeCalculator.calculate(
      policy,
      totalProductAmount,
      isRemoteIsland,
    );

    return CartAmountDto.from(
      totalProductAmount,
      shippingFee,
      policy.freeShippingThreshold,
      isRemoteIsland,
    );
  }
}

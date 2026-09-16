import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { CartItemEntity } from '@app/repository/entity/cart-item.entity';
import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderShippingEntity } from '@app/repository/entity/order-shipping.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { OrderStatus } from '@app/repository/enum/order.enum';
import { CartRepositoryService } from '@app/repository/service/cart.repository.service';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { ShippingRepositoryService } from '@app/repository/service/shipping.repository.service';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetUserOrderResponse,
  PostUserOrderPreviewRequest,
  PostUserOrderPreviewResponse,
  PostUserOrderRequest,
  PostUserOrderResponse,
  UserOrderDirectItemRequest,
  UserOrderLineSourceRequest,
  UserOrderShippingRequest,
} from './user.order.dto';
import {
  CartAmountCalculator,
  CartAmountDto,
  CartLineAmountDto,
  ShippingFeeCalculator,
} from '../cart/cart.calculator';
import { CartTextBundleDto } from '../cart/user.cart.dto';
import { UserCartService } from '../cart/user.cart.service';

@Injectable()
export class UserOrderService {
  constructor(
    private readonly cartRepositoryService: CartRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly shippingRepositoryService: ShippingRepositoryService,
    private readonly userRepositoryService: UserRepositoryService,
    private readonly userCartService: UserCartService,
    private readonly cartAmountCalculator: CartAmountCalculator,
    private readonly shippingFeeCalculator: ShippingFeeCalculator,
  ) {}

  /**
   * 주문서 진입 · 배송지 변경 시마다 호출된다. DB 를 건드리지 않는다.
   * 배송비가 주소로 정해지므로 city/district 가 없으면 본섬 기준 예상값을 준다.
   * 배송지를 아직 등록하지 않은 회원도 주문서를 그릴 수 있어야 해서다.
   */
  async preview(
    userId: number,
    dto: PostUserOrderPreviewRequest,
    language: LanguageCode,
  ): Promise<PostUserOrderPreviewResponse> {
    const lines = await this.loadLines(userId, dto);
    const isShippingEstimated = !dto.city || !dto.district;
    const amount = await this.calculateAmount(
      lines,
      isShippingEstimated ? '' : dto.city,
      isShippingEstimated ? '' : dto.district,
    );

    const texts = await this.userCartService.loadTexts(lines, language);
    const groups = this.userCartService.buildBrandGroups(lines, texts);

    return PostUserOrderPreviewResponse.from(
      groups,
      amount,
      isShippingEstimated,
    );
  }

  /**
   * 결제하기 직전. 주문은 PENDING 으로 생성되고 재고는 차감하지 않는다.
   * 장바구니도 비우지 않는다 — 결제창에서 이탈했을 때 담아둔 것이 사라지면 안 된다.
   * items 로 들어온 "구매하기" 주문은 장바구니를 아예 건드리지 않는다.
   */
  @Transactional()
  async createOrder(
    userId: number,
    dto: PostUserOrderRequest,
    language: LanguageCode,
  ): Promise<PostUserOrderResponse> {
    const lines = await this.loadLines(userId, dto);
    const shipping = await this.resolveShipping(userId, dto);

    this.assertPurchasable(lines);

    const amount = await this.calculateAmount(
      lines,
      shipping.city,
      shipping.district,
    );

    const order = await this.persistOrder(userId, dto, amount, shipping);

    const texts = await this.userCartService.loadTexts(lines, language);
    await this.orderRepositoryService.saveItems(
      lines.map((line) => this.toOrderItem(order.id, line, texts)),
    );

    return PostUserOrderResponse.from(
      order.id,
      order.orderNumber,
      amount.totalAmount,
    );
  }

  /**
   * 주문번호는 id 로 만들기 때문에 INSERT 가 끝나야 확정된다.
   * 같은 트랜잭션 안에서 UPDATE 로 채우므로 중간 상태가 밖으로 새지 않는다.
   */
  private async persistOrder(
    userId: number,
    dto: PostUserOrderRequest,
    amount: CartAmountDto,
    shipping: UserOrderShippingRequest,
  ): Promise<OrderEntity> {
    const order = await this.orderRepositoryService.saveOrder(
      plainToInstance(OrderEntity, {
        userId,
        status: OrderStatus.PENDING,
        totalProductAmount: amount.totalProductAmount,
        shippingFeeApplied: amount.shippingFee,
        isRemoteIsland: amount.isRemoteIsland,
        freeShippingThresholdSnapshot: amount.freeShippingThreshold,
        totalAmount: amount.totalAmount,
        paymentMethod: dto.paymentMethod,
      }),
    );

    const orderNumber = OrderEntity.buildOrderNumber(
      order.id,
      order.createDate ?? new Date(),
    );

    await this.orderRepositoryService.updateOrderNumber(order.id, orderNumber);
    await this.orderRepositoryService.saveShipping(
      plainToInstance(OrderShippingEntity, {
        orderId: order.id,
        ...shipping,
      }),
    );

    order.orderNumber = orderNumber;

    return order;
  }

  async getOrder(userId: number, id: number): Promise<GetUserOrderResponse> {
    const order = await this.orderRepositoryService.findDetailByIdAndUserId(
      id,
      userId,
    );

    if (!order) {
      throw new ServiceError(
        `No exist order ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return GetUserOrderResponse.from(order);
  }

  /**
   * 장바구니 경로와 "구매하기" 경로가 같은 CartLineAmountDto 로 모인다.
   * 이후 금액·배송비·스냅샷 로직은 경로를 모른다 — 규칙이 두 벌이 되면 안 된다.
   */
  private async loadLines(
    userId: number,
    dto: UserOrderLineSourceRequest,
  ): Promise<CartLineAmountDto[]> {
    // null 도 "안 보낸 것"으로 본다 — @IsOptional 이 null 을 통과시키기 때문이다
    const hasCartItems = !!dto.cartItemIds;
    const hasItems = !!dto.items;

    if (hasCartItems === hasItems) {
      throw new ServiceError(
        'Exactly one of cartItemIds or items is required',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return hasCartItems
      ? this.loadCartLines(userId, dto.cartItemIds)
      : this.loadDirectLines(userId, dto.items);
  }

  private async loadCartLines(
    userId: number,
    cartItemIds: number[],
  ): Promise<CartLineAmountDto[]> {
    const cartItems = await this.cartRepositoryService.findDetailListByIds(
      userId,
      cartItemIds,
    );

    if (cartItems.length !== cartItemIds.length) {
      throw new ServiceError(
        'Some cart items do not exist or belong to another user',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return this.cartAmountCalculator.toLines(cartItems);
  }

  /**
   * 장바구니에 저장하지 않는 임시 라인을 만든다. 이미 담긴 수량과 합산하지 않으므로
   * 상세에서 고른 수량 그대로 주문된다. id 가 없어 응답의 cartItemId 는 null 이다.
   */
  private async loadDirectLines(
    userId: number,
    items: UserOrderDirectItemRequest[],
  ): Promise<CartLineAmountDto[]> {
    const quantities = new Map<number, number>();

    for (const item of items) {
      quantities.set(
        item.productVariantId,
        (quantities.get(item.productVariantId) ?? 0) + item.quantity,
      );
    }

    const variantIds = Array.from(quantities.keys());
    const variants =
      await this.productRepositoryService.findVariantDetailListByIds(
        variantIds,
      );
    const variantMap = new Map(
      variants.map((variant) => [variant.id, variant]),
    );
    const missing = variantIds.filter((id) => !variantMap.has(id));

    if (missing.length > 0) {
      throw new ServiceError(
        `No exist product variant ID: ${missing.join(', ')}`,
        ServiceErrorCode.NOT_FOUND_DATA,
        { productVariantIds: missing },
      );
    }

    // plainToInstance 는 중첩 엔티티를 평범한 객체로 복사해 getEffectivePrice 같은
    // 메서드를 잃는다. 조회한 엔티티 인스턴스를 그대로 붙인다.
    const cartItems = variantIds.map((variantId) =>
      Object.assign(new CartItemEntity(), {
        userId,
        productVariantId: variantId,
        quantity: quantities.get(variantId),
        productVariant: variantMap.get(variantId),
      }),
    );

    return this.cartAmountCalculator.toLines(cartItems);
  }

  private async calculateAmount(
    lines: CartLineAmountDto[],
    city: string,
    district: string,
  ): Promise<CartAmountDto> {
    const [policy, remoteAreas] = await Promise.all([
      this.shippingRepositoryService.getPolicy(),
      this.shippingRepositoryService.findActiveRemoteAreas(),
    ]);

    const isRemoteIsland = this.shippingFeeCalculator.isRemoteIsland(
      remoteAreas,
      city,
      district,
    );

    return this.cartAmountCalculator.calculateAmount(
      lines,
      policy,
      isRemoteIsland,
    );
  }

  /** 담긴 수량만큼 재고가 남아 있어야 한다. 차감은 결제 확정 단계에서 한다 */
  private assertPurchasable(lines: CartLineAmountDto[]) {
    const unavailable = lines.filter((line) => !line.hasEnoughStock());

    if (unavailable.length === 0) {
      return;
    }

    const detail = unavailable
      .map(
        (line) =>
          `productVariantId=${line.cartItem.productVariantId}(stock=${line.getStockQuantity()}, requested=${line.cartItem.quantity})`,
      )
      .join(', ');

    throw new ServiceError(
      `Some cart items are not purchasable: ${detail}`,
      ServiceErrorCode.CONFLICT,
    );
  }

  /**
   * 기본 배송지는 user_profile + user.phone 을 읽어 복사한다.
   * 주소록 테이블이 없으므로 프로필이 비어 있으면 주문을 만들 수 없다.
   */
  private async resolveShipping(
    userId: number,
    dto: PostUserOrderRequest,
  ): Promise<UserOrderShippingRequest> {
    if (!dto.useDefaultShipping) {
      if (!dto.shipping) {
        throw new ServiceError(
          'shipping is required when useDefaultShipping is false',
          ServiceErrorCode.BAD_REQUEST,
        );
      }

      return dto.shipping;
    }

    const [profile, user] = await Promise.all([
      this.userRepositoryService.findUserProfile(userId),
      this.userRepositoryService.findUserById(userId),
    ]);

    const shipping = {
      recipientName: profile?.name,
      phone: user?.phone,
      postalCode: profile?.postalCode,
      city: profile?.city,
      district: profile?.district,
      detailAddress: profile?.detailAddress,
      requestMessage: dto.shipping?.requestMessage,
    };

    const missing = Object.entries(shipping)
      .filter(([key, value]) => key !== 'requestMessage' && !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new ServiceError(
        `Default shipping address is incomplete: ${missing.join(', ')}`,
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return shipping as UserOrderShippingRequest;
  }

  /**
   * 화면에 필요한 값은 전부 스냅샷으로 복사한다.
   * 상품이 지워지면 product_variant_id 는 NULL 이 되고 이 값들만 남는다.
   */
  private toOrderItem(
    orderId: number,
    line: CartLineAmountDto,
    texts: CartTextBundleDto,
  ): OrderItemEntity {
    const variant = line.cartItem.productVariant;
    const productItem = variant?.productItem;
    const product = productItem?.product;

    return plainToInstance(OrderItemEntity, {
      orderId,
      productVariantId: line.cartItem.productVariantId,
      productItemId: productItem?.id,
      brandId: product?.brand?.id,
      brandNameSnapshot:
        texts.getBrandName(product?.brand?.id) ??
        product?.brand?.englishName ??
        null,
      productNameSnapshot: texts.getProductName(product?.id),
      optionTextSnapshot: texts.getOptionText(variant),
      imageUrlSnapshot: productItem?.getMainImage() ?? null,
      skuSnapshot: variant?.sku ?? null,
      unitPrice: line.unitPrice,
      unitDiscountPrice: line.unitDiscountPrice,
      quantity: line.cartItem.quantity,
      totalPrice: line.totalPrice,
    });
  }
}

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { CartItemEntity } from '@app/repository/entity/cart-item.entity';
import { OrderInvoiceEntity } from '@app/repository/entity/order-invoice.entity';
import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderShippingEntity } from '@app/repository/entity/order-shipping.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { InvoiceStatus, InvoiceType } from '@app/repository/enum/invoice.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { OrderStatus, ShippingType } from '@app/repository/enum/order.enum';
import { CartRepositoryService } from '@app/repository/service/cart.repository.service';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
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
  UserOrderCvsPickupRequest,
  UserOrderDirectItemRequest,
  UserOrderLineSourceRequest,
} from './user.order.dto';
import { InvoiceValidationService } from '../../invoice/invoice-validation.service';
import { UserOrderInvoiceRequest } from '../../invoice/invoice.dto';
import { normalizeTaiwanPhone } from '../../invoice/invoice.util';
import { CvsStoreService } from '../../logistics/cvs-store.service';
import {
  CartAmountCalculator,
  CartAmountDto,
  CartLineAmountDto,
  ShippingFeeCalculator,
} from '../cart/cart.calculator';
import { CartTextBundleDto } from '../cart/user.cart.dto';
import { UserCartService } from '../cart/user.cart.service';

/** 배송비를 정하는 지역. 택배는 縣市·區, 편의점은 매장이 離島인지로 정한다 */
interface ShippingArea {
  city?: string;
  district?: string;
  /** 편의점이면 둘 다 채운다. 매장이 離島이거나 주소가 외섬 지역이면 외섬 요금 */
  cvsOutside?: boolean;
  cvsAddress?: string;
}

/**
 * 매장 주소 앞부분의 縣市 · 鄉鎮市區. '澎湖縣馬公市…' → ['澎湖縣', '馬公市'].
 * 전자지도 응답은 서명이 없어 CVSOutSide 만 믿지 않고 주소로도 한 번 더 판정한다.
 */
function splitTaiwanAddress(address: string): {
  city: string;
  district: string;
} {
  const match = /^(.{2,3}?[縣市])(.{1,4}?[鄉鎮市區])/.exec(address.trim());

  return { city: match?.[1] ?? '', district: match?.[2] ?? '' };
}

/** order_shipping 에 박을 값 */
type ShippingDraft = Partial<OrderShippingEntity> & {
  shippingType: ShippingType;
  recipientName: string;
  phone: string;
};

@Injectable()
export class UserOrderService {
  constructor(
    private readonly cartRepositoryService: CartRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly shippingRepositoryService: ShippingRepositoryService,
    private readonly userRepositoryService: UserRepositoryService,
    private readonly userCartService: UserCartService,
    private readonly cartAmountCalculator: CartAmountCalculator,
    private readonly shippingFeeCalculator: ShippingFeeCalculator,
    private readonly cvsStoreService: CvsStoreService,
    private readonly invoiceValidationService: InvoiceValidationService,
  ) {}

  /**
   * 주문서 진입 · 배송지 변경 시마다 호출된다. DB 를 건드리지 않는다.
   * 배송비가 주소로 정해지므로 city/district 가 없으면 본섬 기준 예상값을 준다.
   * 배송지를 아직 등록하지 않은 회원도 주문서를 그릴 수 있어야 해서다.
   * 편의점 픽업이면 고른 매장(cvsStoreToken)이 離島인지로 정하고, 아직 안 골랐으면 예상값이다.
   */
  async preview(
    userId: number,
    dto: PostUserOrderPreviewRequest,
    language: LanguageCode,
  ): Promise<PostUserOrderPreviewResponse> {
    const lines = await this.loadLines(userId, dto);
    const { area, isShippingEstimated } = await this.previewArea(dto);
    const amount = await this.calculateAmount(lines, area);

    const texts = await this.userCartService.loadTexts(lines, language);
    const groups = this.userCartService.buildBrandGroups(lines, texts);

    return PostUserOrderPreviewResponse.from(
      groups,
      amount,
      isShippingEstimated,
    );
  }

  private async previewArea(
    dto: PostUserOrderPreviewRequest,
  ): Promise<{ area: ShippingArea; isShippingEstimated: boolean }> {
    if (dto.shippingType === ShippingType.CVS) {
      const store = dto.cvsStoreToken
        ? await this.cvsStoreService.findStore(dto.cvsStoreToken)
        : null;

      return {
        area: {
          cvsOutside: store?.isOutsideIsland ?? false,
          cvsAddress: store?.storeAddress,
        },
        isShippingEstimated: !store,
      };
    }

    const isShippingEstimated = !dto.city || !dto.district;

    return {
      area: isShippingEstimated
        ? {}
        : { city: dto.city, district: dto.district },
      isShippingEstimated,
    };
  }

  /**
   * 결제하기 직전. 주문은 PENDING 으로 생성되고 재고는 차감하지 않는다 — 재고는
   * 결제 시작(POST /user/order/:id/payment) 때 잡는다.
   * 장바구니도 비우지 않는다 — 결제창에서 이탈했을 때 담아둔 것이 사라지면 안 된다.
   * 결제가 확정되면 이 주문에 쓴 장바구니 라인만 지운다(order_item.cart_item_id).
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

    const invoice = dto.invoice ?? { type: InvoiceType.MEMBER_CARRIER };
    await this.invoiceValidationService.assertValid(invoice);

    const amount = await this.calculateAmount(lines, {
      city: shipping.city,
      district: shipping.district,
      cvsOutside: shipping.cvsOutside ?? undefined,
      cvsAddress: shipping.cvsStoreAddress ?? undefined,
    });

    const order = await this.persistOrder(userId, dto, amount, shipping);
    await this.persistInvoice(userId, order.id, invoice, shipping.phone);

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
    shipping: ShippingDraft,
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

  /**
   * 고른 방법에 필요한 값만 남긴다 (MEMBER_CARRIER 인데 carrierNum 을 같이 보내도 버린다).
   * 발표 통지는 회원 이메일로, 이메일이 없으면 받는 분 휴대폰으로 간다.
   */
  private async persistInvoice(
    userId: number,
    orderId: number,
    invoice: UserOrderInvoiceRequest,
    phone: string,
  ) {
    const user = await this.userRepositoryService.findUserById(userId);
    const { type } = invoice;
    const usesCarrierNum =
      type === InvoiceType.MOBILE_BARCODE || type === InvoiceType.CITIZEN_CERT;
    const isCompany = type === InvoiceType.COMPANY;

    await this.orderRepositoryService.saveInvoice(
      plainToInstance(OrderInvoiceEntity, {
        orderId,
        type,
        carrierNum: usesCarrierNum ? invoice.carrierNum : null,
        loveCode: type === InvoiceType.DONATION ? invoice.loveCode : null,
        companyTaxId: isCompany ? invoice.companyTaxId : null,
        companyName: isCompany ? invoice.companyName : null,
        customerEmail: user?.email || null,
        customerPhone: normalizeTaiwanPhone(phone) || null,
        status: InvoiceStatus.PENDING,
        attemptCount: 0,
      }),
    );
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

    const payment = await this.paymentRepositoryService.findLatestByOrderId(
      order.id,
    );

    return GetUserOrderResponse.from(order, payment);
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
    area: ShippingArea,
  ): Promise<CartAmountDto> {
    const [policy, remoteAreas] = await Promise.all([
      this.shippingRepositoryService.getPolicy(),
      this.shippingRepositoryService.findActiveRemoteAreas(),
    ]);

    const isRemoteIsland =
      area.cvsOutside !== undefined
        ? this.isRemoteCvs(remoteAreas, area)
        : this.shippingFeeCalculator.isRemoteIsland(
            remoteAreas,
            area.city ?? '',
            area.district ?? '',
          );

    return this.cartAmountCalculator.calculateAmount(
      lines,
      policy,
      isRemoteIsland,
    );
  }

  /** 편의점: ECPay 가 離島 매장이라고 했거나, 매장 주소가 외섬 규칙에 걸리면 외섬 요금 */
  private isRemoteCvs(
    remoteAreas: Parameters<ShippingFeeCalculator['isRemoteIsland']>[0],
    area: ShippingArea,
  ): boolean {
    if (area.cvsOutside) {
      return true;
    }

    const { city, district } = splitTaiwanAddress(area.cvsAddress ?? '');

    return (
      !!city &&
      this.shippingFeeCalculator.isRemoteIsland(remoteAreas, city, district)
    );
  }

  /**
   * 담긴 수량만큼 재고가 남아 있어야 한다. 여기서는 확인만 하고, 실제로 잡는 건
   * 결제 시작 단계다 (StockReservationService)
   */
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
  ): Promise<ShippingDraft> {
    if (dto.shippingType === ShippingType.CVS) {
      return this.resolveCvsShipping(dto.cvsPickup);
    }

    return {
      ...(await this.resolveHomeShipping(userId, dto)),
      shippingType: ShippingType.HOME,
    };
  }

  /** 전자지도에서 고른 매장은 서버가 보관한 것만 믿는다 (1시간) */
  private async resolveCvsShipping(
    pickup: UserOrderCvsPickupRequest | undefined,
  ): Promise<ShippingDraft> {
    const store = pickup
      ? await this.cvsStoreService.findStore(pickup.storeToken)
      : null;

    if (!pickup || !store) {
      throw new ServiceError(
        'CVS store selection expired — select the store again',
        ServiceErrorCode.BAD_REQUEST,
        { field: 'cvsPickup.storeToken' },
      );
    }

    return {
      shippingType: ShippingType.CVS,
      recipientName: pickup.recipientName,
      phone: pickup.phone,
      cvsLogisticsSubType: store.logisticsSubType,
      cvsStoreId: store.storeId,
      cvsStoreName: store.storeName,
      cvsStoreAddress: store.storeAddress,
      cvsStoreTelephone: store.storeTelephone,
      cvsOutside: store.isOutsideIsland,
    };
  }

  private async resolveHomeShipping(
    userId: number,
    dto: PostUserOrderRequest,
  ): Promise<Omit<ShippingDraft, 'shippingType'>> {
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

    return shipping as Omit<ShippingDraft, 'shippingType'>;
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
      // "구매하기" 라인은 장바구니에 저장되지 않아 id 가 없다
      cartItemId: line.cartItem.id ?? null,
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

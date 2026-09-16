import {
  AdminMemberSummaryDto,
  MemberLikeRowDto,
  MemberOrderStatDto,
} from '@app/repository/dto/admin-member.dto';
import { CartItemEntity } from '@app/repository/entity/cart-item.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { UserEntity } from '@app/repository/entity/user.entity';
import { UserRecentEntity } from '@app/repository/entity/user.recent.entity';
import {
  AdminMemberLikeType,
  AdminMemberProvider,
  AdminMemberStatus,
} from '@app/repository/enum/admin-member.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { OrderStatus, PaymentMethod } from '@app/repository/enum/order.enum';
import { ProductItemStatus } from '@app/repository/enum/product.enum';
import { UserProfileGender } from '@app/repository/enum/user-profile.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, Matches } from 'class-validator';

import { MultilingualFieldDto } from '../../dto/multilingual.dto';
import { ListFilterDto, ListSimpleFilterDto } from '../admin.dto';

/** `YYYY-MM-DD` 만 받는다. 시각까지 받으면 타임존 해석이 갈린다 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** SNS 연동이 없으면 이메일 가입이다 */
function resolveProvider(user: UserEntity): AdminMemberProvider {
  return user.sns?.provider
    ? (user.sns.provider as unknown as AdminMemberProvider)
    : AdminMemberProvider.EMAIL;
}

/**
 * entityId -> 표시명 모음.
 *
 * 다국어 텍스트는 언어별로 여러 행이 오므로, 어떤 언어를 쓸지와 폴백을
 * 여기 한 곳에 가둔다. 어드민 화면은 한국어를 먼저 본다.
 */
export class MultilingualNameCollectionDto {
  private nameMap: Record<number, string | null> = {};

  static from(
    texts: MultilingualTextEntity[],
    fieldName = 'name',
  ): MultilingualNameCollectionDto {
    const dto = new MultilingualNameCollectionDto();
    const entityIds = Array.from(new Set(texts.map((text) => text.entityId)));

    for (const entityId of entityIds) {
      dto.nameMap[entityId] = MultilingualFieldDto.fromByEntityList(
        texts.filter((text) => text.entityId === entityId),
        fieldName,
      ).getContentByLanguageWithFallback(LanguageCode.KOREAN);
    }

    return dto;
  }

  getName(entityId: number | null | undefined): string | null {
    if (!entityId) {
      return null;
    }

    return this.nameMap[entityId] ?? null;
  }
}

export class GetAdminMemberListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '가입 경로. EMAIL 은 SNS 연동이 없는 회원',
    enum: AdminMemberProvider,
    example: AdminMemberProvider.LINE,
  })
  @IsOptional()
  @IsEnum(AdminMemberProvider)
  provider?: AdminMemberProvider;

  @ApiPropertyOptional({
    description:
      '회원 상태. 기본값 ACTIVE. WITHDRAWN 을 보낼 때만 탈퇴 회원을 조회한다',
    enum: AdminMemberStatus,
    default: AdminMemberStatus.ACTIVE,
    example: AdminMemberStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AdminMemberStatus)
  status?: AdminMemberStatus = AdminMemberStatus.ACTIVE;

  @ApiPropertyOptional({
    description: '가입일 시작 (YYYY-MM-DD, UTC 기준 00:00:00 포함)',
    example: '2026-08-01',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'joinedFrom must be YYYY-MM-DD' })
  joinedFrom?: string;

  @ApiPropertyOptional({
    description: '가입일 종료 (YYYY-MM-DD, UTC 기준 23:59:59 포함)',
    example: '2026-09-15',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'joinedTo must be YYYY-MM-DD' })
  joinedTo?: string;

  @ApiPropertyOptional({
    description: '광고·이벤트 수신 동의 여부',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : value === 'true' || value === true,
  )
  @IsBoolean()
  adAgreed?: boolean;
}

export class GetAdminMemberListResponse {
  @ApiProperty({ description: '회원 ID', example: 1042 })
  id: number;

  @ApiProperty({
    description: '이메일. 탈퇴 회원은 익명값이다',
    example: 'chen.yj@gmail.com',
  })
  email: string;

  @ApiProperty({ description: '닉네임', example: 'chen_yj' })
  nickname: string;

  @ApiProperty({
    description: '이름 (프로필). 없으면 null',
    example: '陳雅婷',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: '전화번호. 없으면 null',
    example: '+886912345678',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    description: '가입 경로',
    enum: AdminMemberProvider,
    example: AdminMemberProvider.LINE,
  })
  provider: AdminMemberProvider;

  @ApiProperty({
    description: '전체 주문 건수 (취소·실패 포함)',
    example: 4,
  })
  orderCount: number;

  @ApiProperty({
    description: '결제 완료(PAID) 주문의 결제 금액 합',
    example: 6420,
  })
  paidAmount: number;

  @ApiProperty({
    description: '마지막 주문 일시. 주문이 없으면 null',
    example: '2026-09-08T04:12:00.000Z',
    nullable: true,
  })
  lastOrderDate: Date | null;

  @ApiProperty({
    description: '가입일',
    example: '2026-08-12T02:31:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '탈퇴 일시. 활성 회원은 null',
    example: null,
    nullable: true,
  })
  withdrawnAt: Date | null;

  static from(
    user: UserEntity,
    stat: MemberOrderStatDto,
  ): GetAdminMemberListResponse {
    return plainToInstance(GetAdminMemberListResponse, {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      name: user.profile?.name ?? null,
      phone: user.phone ?? null,
      provider: resolveProvider(user),
      orderCount: stat.orderCount,
      paidAmount: stat.paidAmount,
      lastOrderDate: stat.lastOrderDate,
      createDate: user.createDate,
      withdrawnAt: user.deleteDate ?? null,
    });
  }
}

export class AdminMemberProviderCountResponse {
  @ApiProperty({ description: '이메일 가입', example: 719 })
  EMAIL: number;

  @ApiProperty({ description: '구글 연동', example: 842 })
  GOOGLE: number;

  @ApiProperty({ description: 'LINE 연동', example: 920 })
  LINE: number;
}

export class GetAdminMemberSummaryResponse {
  @ApiProperty({ description: '전체 활성 회원 수', example: 2481 })
  total: number;

  @ApiProperty({ description: '최근 7일 신규 가입 수', example: 63 })
  newIn7Days: number;

  @ApiProperty({ description: '누적 탈퇴 회원 수', example: 118 })
  withdrawn: number;

  @ApiProperty({
    description: '가입 경로별 활성 회원 수',
    type: AdminMemberProviderCountResponse,
  })
  byProvider: AdminMemberProviderCountResponse;

  static from(summary: AdminMemberSummaryDto): GetAdminMemberSummaryResponse {
    return plainToInstance(GetAdminMemberSummaryResponse, {
      total: summary.total,
      newIn7Days: summary.newIn7Days,
      withdrawn: summary.withdrawn,
      byProvider: {
        EMAIL: summary.byProvider.getCount(AdminMemberProvider.EMAIL),
        GOOGLE: summary.byProvider.getCount(AdminMemberProvider.GOOGLE),
        LINE: summary.byProvider.getCount(AdminMemberProvider.LINE),
      },
    });
  }
}

export class AdminMemberSnsResponse {
  @ApiProperty({
    description: 'SNS 제공자',
    enum: AdminMemberProvider,
    example: AdminMemberProvider.LINE,
  })
  provider: AdminMemberProvider;

  @ApiProperty({
    description: 'SNS 계정 이메일. 제공하지 않는 경우 null',
    example: 'chen.yj@gmail.com',
    nullable: true,
  })
  providerEmail: string | null;
}

export class AdminMemberProfileResponse {
  @ApiProperty({ description: '이름', example: '陳雅婷', nullable: true })
  name: string | null;

  @ApiProperty({
    description: '성별',
    enum: UserProfileGender,
    example: UserProfileGender.FEMALE,
    nullable: true,
  })
  gender: UserProfileGender | null;

  @ApiProperty({
    description: '생년월일',
    example: '1996-02-03',
    nullable: true,
  })
  birthDate: string | null;

  @ApiProperty({ description: '우편번호', example: '110', nullable: true })
  postalCode: string | null;

  @ApiProperty({ description: '시/도', example: '臺北市', nullable: true })
  city: string | null;

  @ApiProperty({ description: '시/군/구', example: '信義區', nullable: true })
  district: string | null;

  @ApiProperty({
    description: '상세 주소',
    example: '松高路 11號 5樓',
    nullable: true,
  })
  detailAddress: string | null;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://image-dev.seoulmoment.com.tw/user/2026-08-12/a.jpg',
    nullable: true,
  })
  imageUrl: string | null;
}

export class AdminMemberFitResponse {
  @ApiProperty({ description: '키 (cm)', example: 163, nullable: true })
  height: number | null;

  @ApiProperty({ description: '몸무게 (kg)', example: 52, nullable: true })
  weight: number | null;

  @ApiProperty({
    description: '신발 사이즈 (mm 단위 정수)',
    example: 240,
    nullable: true,
  })
  shoeSize: number | null;

  @ApiProperty({ description: '아우터 사이즈', example: 'M', nullable: true })
  outerSize: string | null;

  @ApiProperty({ description: '상의 사이즈', example: 'M', nullable: true })
  topSize: string | null;

  @ApiProperty({ description: '하의 사이즈', example: '28', nullable: true })
  bottomSize: string | null;
}

export class AdminMemberAgreementResponse {
  @ApiProperty({
    description: '이용약관 동의 일시 (변경 불가)',
    example: '2026-08-12T02:31:00.000Z',
  })
  termsOfServiceAgreeDate: Date;

  @ApiProperty({
    description: '개인정보 수집·이용 동의 일시 (변경 불가)',
    example: '2026-08-12T02:31:00.000Z',
  })
  privacyPolicyAgreeDate: Date;

  @ApiProperty({
    description: '신상품·기획전 알림 동의 일시. 미동의면 null',
    example: '2026-08-12T02:31:00.000Z',
    nullable: true,
  })
  newProductDate: Date | null;

  @ApiProperty({
    description: '광고·이벤트 이메일 동의 일시. 미동의면 null',
    example: null,
    nullable: true,
  })
  adAgreeDate: Date | null;

  @ApiProperty({
    description: '맞춤 추천 동의 일시. 미동의면 null',
    example: '2026-08-12T02:31:00.000Z',
    nullable: true,
  })
  recommendDate: Date | null;
}

export class GetAdminMemberResponse {
  @ApiProperty({ description: '회원 ID', example: 1042 })
  id: number;

  @ApiProperty({ description: '이메일', example: 'chen.yj@gmail.com' })
  email: string;

  @ApiProperty({ description: '닉네임', example: 'chen_yj' })
  nickname: string;

  @ApiProperty({
    description: '전화번호',
    example: '+886912345678',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({ description: '가입일', example: '2026-08-12T02:31:00.000Z' })
  createDate: Date;

  @ApiProperty({
    description: '탈퇴 일시. 활성 회원은 null',
    example: null,
    nullable: true,
  })
  withdrawnAt: Date | null;

  @ApiProperty({
    description: 'SNS 연동. 이메일 가입이거나 탈퇴 회원이면 null',
    type: AdminMemberSnsResponse,
    nullable: true,
  })
  sns: AdminMemberSnsResponse | null;

  @ApiProperty({
    description: '프로필. 미작성이면 null',
    type: AdminMemberProfileResponse,
    nullable: true,
  })
  profile: AdminMemberProfileResponse | null;

  @ApiProperty({
    description: '체형 정보. 미작성이면 null',
    type: AdminMemberFitResponse,
    nullable: true,
  })
  fit: AdminMemberFitResponse | null;

  @ApiProperty({
    description: '약관·수신 동의',
    type: AdminMemberAgreementResponse,
  })
  agreement: AdminMemberAgreementResponse;

  static from(user: UserEntity): GetAdminMemberResponse {
    return plainToInstance(GetAdminMemberResponse, {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      phone: user.phone ?? null,
      createDate: user.createDate,
      withdrawnAt: user.deleteDate ?? null,
      sns: GetAdminMemberResponse.buildSns(user),
      profile: GetAdminMemberResponse.buildProfile(user),
      fit: GetAdminMemberResponse.buildFit(user),
      agreement: GetAdminMemberResponse.buildAgreement(user),
    });
  }

  private static buildSns(user: UserEntity): AdminMemberSnsResponse | null {
    if (!user.sns) {
      return null;
    }

    return {
      provider: user.sns.provider as unknown as AdminMemberProvider,
      providerEmail: user.sns.providerEmail ?? null,
    };
  }

  private static buildProfile(
    user: UserEntity,
  ): AdminMemberProfileResponse | null {
    if (!user.profile) {
      return null;
    }

    const profile = user.profile;

    return {
      name: profile.name ?? null,
      gender: profile.gender ?? null,
      birthDate: profile.birthDate ?? null,
      postalCode: profile.postalCode ?? null,
      city: profile.city ?? null,
      district: profile.district ?? null,
      detailAddress: profile.detailAddress ?? null,
      imageUrl: profile.image?.getImageUrl() ?? null,
    };
  }

  private static buildFit(user: UserEntity): AdminMemberFitResponse | null {
    if (!user.fit) {
      return null;
    }

    const fit = user.fit;

    return {
      height: fit.height ?? null,
      weight: fit.weight ?? null,
      shoeSize: fit.shoeSize ?? null,
      outerSize: fit.outerSize ?? null,
      topSize: fit.topSize ?? null,
      bottomSize: fit.bottomSize ?? null,
    };
  }

  private static buildAgreement(
    user: UserEntity,
  ): AdminMemberAgreementResponse {
    return {
      termsOfServiceAgreeDate: user.termsOfServiceAgreeDate,
      privacyPolicyAgreeDate: user.privacyPolicyAgreeDate,
      newProductDate: user.newProductDate ?? null,
      adAgreeDate: user.adAgreeDate ?? null,
      recommendDate: user.recommendDate ?? null,
    };
  }
}

/**
 * 마케팅 수신 동의 변경.
 *
 * DB 는 boolean 이 아니라 동의 일시라서, true 를 받으면 서버가 현재 시각을
 * 넣고 false 면 null 로 지운다. 클라이언트가 날짜를 만들어 보내지 않는다.
 * 이용약관·개인정보 동의 일시는 가입 시점의 법적 기록이라 바꿀 수 없다.
 */
export class PatchAdminMemberAgreementRequest {
  @ApiPropertyOptional({
    description: '신상품·기획전 알림 동의 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  newProduct?: boolean;

  @ApiPropertyOptional({
    description: '광고·이벤트 이메일 동의 여부',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  ad?: boolean;

  @ApiPropertyOptional({
    description: '개인 맞춤 상품 추천 동의 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  recommend?: boolean;

  /** 셋 다 비어 있으면 바꿀 것이 없다 — 400 으로 끊기 위한 표식 */
  isEmpty(): boolean {
    return (
      this.newProduct === undefined &&
      this.ad === undefined &&
      this.recommend === undefined
    );
  }
}

export class GetAdminMemberOrderListRequest extends ListSimpleFilterDto {
  @ApiPropertyOptional({
    description: '주문 상태. 생략하면 취소·실패를 포함한 전체',
    enum: OrderStatus,
    example: OrderStatus.PAID,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class GetAdminMemberOrderListResponse {
  @ApiProperty({ description: '주문 ID', example: 481 })
  id: number;

  @ApiProperty({
    description: '주문번호',
    example: 'SM-20260908-000481',
    nullable: true,
  })
  orderNumber: string | null;

  @ApiProperty({
    description: '주문 상태',
    enum: OrderStatus,
    example: OrderStatus.PAID,
  })
  status: OrderStatus;

  @ApiProperty({ description: '상품 금액 합', example: 2250 })
  totalProductAmount: number;

  @ApiProperty({ description: '실제 청구한 배송비', example: 60 })
  shippingFeeApplied: number;

  @ApiProperty({ description: '최종 결제 금액', example: 2310 })
  totalAmount: number;

  @ApiProperty({
    description: '결제 수단. 미선택이면 null',
    enum: PaymentMethod,
    example: PaymentMethod.LINE_PAY,
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @ApiProperty({ description: '주문 라인 수', example: 2 })
  itemCount: number;

  @ApiProperty({
    description: '주문 일시',
    example: '2026-09-08T04:12:00.000Z',
  })
  createDate: Date;

  static from(order: OrderEntity): GetAdminMemberOrderListResponse {
    return plainToInstance(GetAdminMemberOrderListResponse, {
      id: order.id,
      orderNumber: order.orderNumber ?? null,
      status: order.status,
      totalProductAmount: order.totalProductAmount,
      shippingFeeApplied: order.shippingFeeApplied,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod ?? null,
      itemCount: order.items?.length ?? 0,
      createDate: order.createDate,
    });
  }
}

export class GetAdminMemberCartResponse {
  @ApiProperty({ description: '장바구니 라인 ID', example: 3312 })
  id: number;

  @ApiProperty({ description: '상품 변형(SKU) ID', example: 8821 })
  productVariantId: number;

  @ApiProperty({ description: '수량', example: 2 })
  quantity: number;

  @ApiProperty({
    description: '상품명. 상품이 지워졌으면 null',
    example: '오버사이즈 워시드 셔츠',
    nullable: true,
  })
  productName: string | null;

  @ApiProperty({
    description: '옵션 조합 텍스트',
    example: 'IVORY / M',
  })
  optionText: string;

  @ApiProperty({ description: '적용가 (할인가 우선)', example: 590 })
  price: number;

  @ApiProperty({
    description:
      '아직 팔 수 있는 상품인지. false 면 담긴 뒤 상품이 내려간 것이다',
    example: true,
  })
  isAvailable: boolean;

  @ApiProperty({
    description: '담은 일시',
    example: '2026-08-25T11:02:00.000Z',
  })
  createDate: Date;

  static from(
    cartItem: CartItemEntity,
    productName: string | null,
    optionText: string,
  ): GetAdminMemberCartResponse {
    const productItem = cartItem.productVariant?.productItem;

    return plainToInstance(GetAdminMemberCartResponse, {
      id: cartItem.id,
      productVariantId: cartItem.productVariantId,
      quantity: cartItem.quantity,
      productName,
      optionText,
      price: productItem?.getEffectivePrice() ?? 0,
      isAvailable: productItem?.status === ProductItemStatus.NORMAL,
      createDate: cartItem.createDate,
    });
  }
}

export class GetAdminMemberLikeListRequest extends ListSimpleFilterDto {
  @ApiPropertyOptional({
    description: '좋아요 종류. 생략하면 상품·브랜드를 섞어 최신순으로 내린다',
    enum: AdminMemberLikeType,
    example: AdminMemberLikeType.PRODUCT,
  })
  @IsOptional()
  @IsEnum(AdminMemberLikeType)
  type?: AdminMemberLikeType;
}

export class GetAdminMemberLikeResponse {
  @ApiProperty({
    description: '좋아요 종류',
    enum: AdminMemberLikeType,
    example: AdminMemberLikeType.PRODUCT,
  })
  type: AdminMemberLikeType;

  @ApiProperty({
    description:
      'PRODUCT 면 product_item.id, BRAND 면 brand.id. 종류마다 참조가 다르다',
    example: 3310,
  })
  targetId: number;

  @ApiProperty({
    description: '표시명. 다국어 텍스트가 없으면 null',
    example: '린넨 블렌드 자켓',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: '대표 이미지 URL. BRAND 는 항상 null',
    example: 'https://image-dev.seoulmoment.com.tw/product/2026-08-01/a.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    description: '좋아요 등록 일시',
    example: '2026-09-01T08:20:00.000Z',
  })
  createDate: Date;

  static from(
    row: MemberLikeRowDto,
    name: string | null,
    imageUrl: string | null,
  ): GetAdminMemberLikeResponse {
    return plainToInstance(GetAdminMemberLikeResponse, {
      type: row.type,
      targetId: row.targetId,
      name,
      imageUrl,
      createDate: row.createDate,
    });
  }
}

export class GetAdminMemberRecentResponse {
  @ApiProperty({ description: '상품 아이템 ID', example: 3310 })
  productItemId: number;

  @ApiProperty({
    description: '상품명. 다국어 텍스트가 없으면 null',
    example: '린넨 블렌드 자켓',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: '대표 이미지 URL',
    example: 'https://image-dev.seoulmoment.com.tw/product/2026-08-01/a.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    description: '마지막으로 본 일시',
    example: '2026-09-14T13:44:00.000Z',
  })
  updateDate: Date;

  static from(
    recent: UserRecentEntity,
    name: string | null,
  ): GetAdminMemberRecentResponse {
    const productItem: ProductItemEntity | undefined = recent.productItem;

    return plainToInstance(GetAdminMemberRecentResponse, {
      productItemId: recent.productItemId,
      name,
      imageUrl: productItem?.getMainImage() || null,
      updateDate: recent.updateDate,
    });
  }
}

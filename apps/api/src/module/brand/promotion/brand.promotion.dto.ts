/* eslint-disable max-lines-per-function */
import { DeviceType } from '@app/repository/dto/common.dto';
import { BrandPromotionBannerEntity } from '@app/repository/entity/brand-promotion-banner.entity';
import { BrandPromotionEventCouponEntity } from '@app/repository/entity/brand-promotion-event-coupon.entity';
import { BrandPromotionEventEntity } from '@app/repository/entity/brand-promotion-event.entity';
import { BrandPromotionNoticeEntity } from '@app/repository/entity/brand-promotion-notice.entity';
import { BrandPromotionPopupEntity } from '@app/repository/entity/brand-promotion-popup.entity';
import { BrandPromotionSectionEntity } from '@app/repository/entity/brand-promotion-section.entity';
import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { BrandPromotionEventCouponStatus } from '@app/repository/enum/brand-promotion-event-coupon.enum';
import { BrandPromotionSectionType } from '@app/repository/enum/brand-promotion-section';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { MultilingualFieldDto } from '../../dto/multilingual.dto';

export class GetBrandPromotionBrandResponse {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  brandId: number;

  @ApiProperty({
    description: '브랜드 프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsDefined()
  profileImageUrl: string;

  @ApiProperty({
    description: '브랜드 이름',
    example: '브랜드 이름',
  })
  @IsString()
  @IsDefined()
  name: string;

  static from(entity: BrandPromotionEntity) {
    return {
      id: entity.id,
      brandId: entity.brandId,
      profileImageUrl: entity.brand.getProfileImage(),
      name: entity.brand.englishName,
    };
  }
}

export class GetBrandPromotionBrandDetailResponse {
  @ApiProperty({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 이름',
    example: '브랜드 이름',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '브랜드 프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsDefined()
  profileImageUrl: string;

  @ApiProperty({
    description: '브랜드 설명',
    example: '브랜드 설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  @ApiProperty({
    description: '브랜드 좋아요 수',
    example: 100,
  })
  @IsNumber()
  @IsDefined()
  likeCount: number;

  @ApiProperty({
    description: '브랜드 색상',
    example: '#FF0000',
  })
  @IsString()
  @IsDefined()
  colorCode: string;

  static from(
    entity: BrandPromotionEntity,
    multilingualTexts: MultilingualTextEntity[],
  ) {
    const descriptionTextsByEntityAndLanguage =
      MultilingualFieldDto.fromByEntity(multilingualTexts, 'description');

    return {
      id: entity.brand.id,
      name: entity.brand.englishName,
      profileImageUrl: entity.brand.getProfileImage(),
      description: descriptionTextsByEntityAndLanguage.getContent(),
      likeCount: Math.floor(Math.random() * 50001),
      colorCode: entity.brand.colorCode,
    };
  }
}

export class GetBrandPromotionBannerResponse {
  @ApiProperty({
    description: '브랜드 프로모션 배너 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '배너 이미지 경로',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-promotion-banners/2025-09-16/banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 경로',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-promotion-banners/2025-09-16/banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  mobileImageUrl: string;

  @ApiProperty({
    description: '배너 링크 URL',
    example: 'https://example.com',
  })
  @IsString()
  @IsDefined()
  linkUrl: string;

  @ApiProperty({
    description: '배너 제목',
    example: '배너 제목',
  })
  @IsString()
  @IsDefined()
  @IsOptional()
  title?: string;

  static from(
    entity: BrandPromotionBannerEntity,
    multilingualTexts: MultilingualTextEntity[],
  ) {
    const titleTextsByEntityAndLanguage = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'title',
    );

    return {
      id: entity.id,
      imageUrl: entity.images
        .find((image) => image.deviceType === DeviceType.DESKTOP)
        ?.getImage(),
      mobileImageUrl: entity.images
        .find((image) => image.deviceType === DeviceType.MOBILE)
        ?.getImage(),
      linkUrl: entity.linkUrl,
      title: titleTextsByEntityAndLanguage.getContent(),
    };
  }
}

export class GetBrandPromotionSectionResponse {
  @ApiProperty({
    description: '브랜드 프로모션 섹션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 섹션 타입',
    example: BrandPromotionSectionType.TYPE_1,
    enum: BrandPromotionSectionType,
  })
  @IsEnum(BrandPromotionSectionType)
  @IsDefined()
  type: BrandPromotionSectionType;

  @ApiProperty({
    description: '브랜드 프로모션 섹션 이미지 경로 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-promotion-sections/2025-09-16/section-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-sections/2025-09-16/section-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-sections/2025-09-16/section-03.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];

  static from(entity: BrandPromotionSectionEntity) {
    return plainToInstance(this, {
      id: entity.id,
      type: entity.type,
      imageUrlList: entity.images.map((image) => image.getImageUrl()),
    });
  }
}

export class GetBrandPromotionProductResponse {
  @ApiProperty({
    description: '상품 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 이름',
    example: '51퍼센트',
  })
  brandName: string;

  @ApiProperty({
    description: '상품 이름',
    example: '51퍼센트',
  })
  productName: string;

  @ApiProperty({
    description: '가격 (할인 가격이 있으면 할인가격 보여줌)',
    example: 189000,
  })
  price: number;

  @ApiProperty({
    description: '좋아요 수',
    example: 54244,
  })
  like: number;

  @ApiProperty({
    description: '리뷰 수',
    example: 54244,
  })
  review: number;

  @ApiProperty({
    description: '별점 평균',
    example: 4.5,
  })
  reviewAverage: number;

  @ApiProperty({
    description: '상품이미지',
    example: 'https://image-dev.seoulmoment.com.tw/product/product_red_1.png',
  })
  imageUrl: string;

  static from(
    entity: ProductItemEntity,
    multilingualText: {
      brand: MultilingualTextEntity[];
      product: MultilingualTextEntity[];
    },
  ) {
    multilingualText.brand = multilingualText.brand.filter(
      (v) => v.entityId === entity.product.brand.id,
    );

    multilingualText.product = multilingualText.product.filter(
      (v) => v.entityId === entity.product.id,
    );

    const brandName = MultilingualFieldDto.fromByEntity(
      multilingualText.brand,
      'name',
    );
    const productName = MultilingualFieldDto.fromByEntity(
      multilingualText.product,
      'name',
    );

    return plainToInstance(this, {
      id: entity.id,
      brandName: brandName.getContent(),
      productName: productName.getContent(),
      price: entity.getEffectivePrice(),
      like: Math.floor(Math.random() * 50001),
      review: Math.floor(Math.random() * 101),
      reviewAverage: Math.round((Math.random() + 4) * 10) / 10,
      imageUrl: entity.getMainImage(),
    });
  }
}

export class GetBrandPromotionPopupResponse {
  @ApiProperty({
    description: '브랜드 프로모션 팝업 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '장소',
    example: '장소',
  })
  @IsString()
  @IsDefined()
  place: string;

  @ApiProperty({
    description: '주소',
    example: '주소',
  })
  @IsString()
  @IsDefined()
  address: string;

  @ApiProperty({
    description: '위도',
    example: '위도',
  })
  @IsString()
  @IsDefined()
  latitude: string;

  @ApiProperty({
    description: '경도',
    example: '경도',
  })
  @IsString()
  @IsDefined()
  longitude: string;

  @ApiProperty({
    description: '시작일',
    example: '시작일',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '시작 시간',
    example: '10:00',
  })
  @IsString()
  @IsDefined()
  startTime: string;

  @ApiPropertyOptional({
    description: '종료일, null일 경우 상시 진행',
    example: '2025-03-01',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: '종료 시간',
    example: '20:00',
  })
  @IsString()
  @IsDefined()
  endTime: string;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '설명',
    example: '설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  @ApiProperty({
    description: '이미지 경로 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-03.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];

  static from(
    entity: BrandPromotionPopupEntity,
    multilingualTexts: MultilingualTextEntity[],
  ) {
    multilingualTexts = multilingualTexts.filter(
      (v) => v.entityId === entity.id,
    );

    const title = MultilingualFieldDto.fromByEntity(multilingualTexts, 'title');
    const description = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'description',
    );

    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      place: entity.place,
      address: entity.address,
      latitude: entity.latitude,
      longitude: entity.longitude,
      startDate: entity.startDate,
      endDate: entity.endDate,
      startTime: entity.startTime,
      endTime: entity.endTime,
      title: title.getContent(),
      description: description.getContent(),
      imageUrlList: entity.images.map((image) => image.getImageUrl()),
    });
  }
}

export class GetBrandPromotionEventCouponResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 쿠폰 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '쿠폰 이미지 경로',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-promotion-event-coupons/2025-09-16/coupon-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '설명',
    example: '설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventCouponStatus.NORMAL,
    enum: BrandPromotionEventCouponStatus,
  })
  @IsEnum(BrandPromotionEventCouponStatus)
  @IsDefined()
  status?: BrandPromotionEventCouponStatus;

  static from(
    entity: BrandPromotionEventCouponEntity,
    multilingualTexts: MultilingualTextEntity[],
  ) {
    const title = MultilingualFieldDto.fromByEntity(multilingualTexts, 'title');
    const description = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'description',
    );

    return plainToInstance(this, {
      id: entity.id,
      imageUrl: entity.getImageUrl(),
      title: title.getContent(),
      description: description.getContent(),
      status: entity.status,
    });
  }
}

export class GetBrandPromotionEventAndCouponResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '쿠폰 목록',
    type: [GetBrandPromotionEventCouponResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionEventCouponResponse)
  @IsDefined()
  couponList: GetBrandPromotionEventCouponResponse[];

  static from(
    entity: BrandPromotionEventEntity,
    multilingualTexts: MultilingualTextEntity[],
    couponList: GetBrandPromotionEventCouponResponse[],
  ) {
    multilingualTexts = multilingualTexts.filter(
      (v) => v.entityId === entity.id,
    );

    const title = MultilingualFieldDto.fromByEntity(multilingualTexts, 'title');

    return plainToInstance(this, {
      id: entity.id,
      title: title.getContent(),
      couponList,
    });
  }
}

export class GetBrandPromotionNoticeResponse {
  @ApiProperty({
    description: '브랜드 프로모션 공지 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '내용',
    example: '내용',
  })
  @IsString()
  @IsDefined()
  content: string;

  static from(
    entity: BrandPromotionNoticeEntity,
    multilingualTexts: MultilingualTextEntity[],
  ) {
    multilingualTexts = multilingualTexts.filter(
      (v) => v.entityId === entity.id,
    );

    const content = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'content',
    );

    return plainToInstance(this, {
      id: entity.id,
      content: content.getContent(),
    });
  }
}

export class GetBrandPromotionResponse {
  @ApiProperty({
    description: '브랜드 프로모션 배너 목록',
    type: [GetBrandPromotionBannerResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionBannerResponse)
  @IsDefined()
  bannerList: GetBrandPromotionBannerResponse[];

  @ApiProperty({
    description: '브랜드 정보',
    type: GetBrandPromotionBrandDetailResponse,
  })
  @ValidateNested()
  @Type(() => GetBrandPromotionBrandDetailResponse)
  @IsDefined()
  brand: GetBrandPromotionBrandDetailResponse;

  @ApiProperty({
    description: '브랜드 프로모션 섹션 목록',
    type: [GetBrandPromotionSectionResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionSectionResponse)
  @IsDefined()
  sectionList: GetBrandPromotionSectionResponse[];

  @ApiProperty({
    description: '브랜드 프로모션 상품 목록',
    type: [GetBrandPromotionProductResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionProductResponse)
  @IsDefined()
  productList: GetBrandPromotionProductResponse[];

  @ApiProperty({
    description: '브랜드 프로모션 팝업 목록',
    type: [GetBrandPromotionPopupResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionPopupResponse)
  @IsDefined()
  popupList: GetBrandPromotionPopupResponse[];

  @ApiProperty({
    description: '브랜드 프로모션 이벤트 목록',
    type: [GetBrandPromotionEventAndCouponResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionEventAndCouponResponse)
  @IsDefined()
  eventList: GetBrandPromotionEventAndCouponResponse[];

  @ApiProperty({
    description: '브랜드 프로모션 공지 목록',
    type: [GetBrandPromotionNoticeResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionNoticeResponse)
  @IsDefined()
  noticeList: GetBrandPromotionNoticeResponse[];

  static from(
    bannerList: GetBrandPromotionBannerResponse[],
    brand: GetBrandPromotionBrandDetailResponse,
    sectionList: GetBrandPromotionSectionResponse[],
    productList: GetBrandPromotionProductResponse[],
    popupList: GetBrandPromotionPopupResponse[],
    eventList: GetBrandPromotionEventAndCouponResponse[],
    noticeList: GetBrandPromotionNoticeResponse[],
  ) {
    return plainToInstance(this, {
      bannerList,
      brand,
      sectionList,
      productList,
      popupList,
      eventList,
      noticeList,
    });
  }
}

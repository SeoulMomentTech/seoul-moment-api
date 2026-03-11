import { BrandPromotionEventCouponEntity } from '@app/repository/entity/brand-promotion-event-coupon.entity';
import { BrandPromotionEventEntity } from '@app/repository/entity/brand-promotion-event.entity';
import { BrandPromotionEventCouponStatus } from '@app/repository/enum/brand-promotion-event-coupon.enum';
import { BrandPromotionEventStatus } from '@app/repository/enum/brand-promotion-event.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../../../admin.dto';

export class PostAdminBrandPromotionEventLanguageDto {
  @ApiProperty({
    description: '언어 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  static from(languageId: number, title: string) {
    return plainToInstance(this, {
      languageId,
      title,
    });
  }
}

export class GetAdminBrandPromotionEventLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  static from(languageCode: LanguageCode, title: string) {
    return plainToInstance(this, {
      languageCode,
      title,
    });
  }
}

export class PostAdminBrandPromotionEventRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [PostAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageId: 1,
        title: '제목',
      },
      {
        languageId: 2,
        title: 'Title',
      },
      {
        languageId: 3,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: PostAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;
}

export class GetAdminBrandPromotionEventListRequest extends ListFilterDto {}

export class GetAdminBrandPromotionEventResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Title',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: Date;

  static from(
    entity: BrandPromotionEventEntity,
    language: GetAdminBrandPromotionEventLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class GetAdminBrandPromotionEventDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Title',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: Date;

  static from(
    entity: BrandPromotionEventEntity,
    language: GetAdminBrandPromotionEventLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PatchAdminBrandPromotionEventRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Title',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;

  static from(
    entity: BrandPromotionEventEntity,
    language: GetAdminBrandPromotionEventLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PostAdminBrandPromotionEventCouponLanguageDto {
  @ApiProperty({
    description: '언어 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '쿠폰 제목',
    example: '쿠폰 제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '쿠폰 설명',
    example: '쿠폰 설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  static from(languageId: number, title: string, description: string) {
    return plainToInstance(this, {
      languageId,
      title,
      description,
    });
  }
}

export class GetAdminBrandPromotionEventCouponLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '쿠폰 제목',
    example: '쿠폰 제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '쿠폰 설명',
    example: '쿠폰 설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  static from(languageCode: LanguageCode, title: string, description: string) {
    return plainToInstance(this, {
      languageCode,
      title,
      description,
    });
  }
}

export class PostAdminBrandPromotionEventCouponRequest {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionEventId: number;

  @ApiProperty({
    description: '쿠폰 이미지 경로',
    example: '/brand-promotion-event-coupons/2025-09-16/coupon-01.jpg',
  })
  @IsString()
  @IsDefined()
  imagePath: string;

  @ApiProperty({
    description: '언어별 내용',
    type: [PostAdminBrandPromotionEventCouponLanguageDto],
    example: [
      {
        languageId: 1,
        title: '쿠폰 제목',
        description: '쿠폰 설명',
      },
      {
        languageId: 2,
        title: 'Coupon Title',
        description: 'Coupon Description',
      },
      {
        languageId: 3,
        title: '优惠券标题',
        description: '优惠券描述',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionEventCouponLanguageDto)
  @IsDefined()
  language: PostAdminBrandPromotionEventCouponLanguageDto[];
}

export class GetAdminBrandPromotionEventCouponResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 쿠폰 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionEventId: number;

  @ApiProperty({
    description: '쿠폰 이미지 경로',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-promotion-event-coupons/2025-09-16/coupon-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionEventCouponLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '쿠폰 제목',
        description: '쿠폰 설명',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Coupon Title',
        description: 'Coupon Description',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '优惠券标题',
        description: '优惠券描述',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventCouponLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventCouponLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventCouponStatus.NORMAL,
    enum: BrandPromotionEventCouponStatus,
  })
  @IsEnum(BrandPromotionEventCouponStatus)
  @IsDefined()
  status: BrandPromotionEventCouponStatus;

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: Date;

  static from(
    entity: BrandPromotionEventCouponEntity,
    language: GetAdminBrandPromotionEventCouponLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionEventId: entity.brandPromotionEventId,
      imageUrl: entity.getImageUrl(),
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class GetAdminBrandPromotionEventCouponListRequest extends ListFilterDto {}

export class GetAdminBrandPromotionEventCouponDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 쿠폰 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionEventId: number;

  @ApiProperty({
    description: '쿠폰 이미지 경로',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-promotion-event-coupons/2025-09-16/coupon-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionEventCouponLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '쿠폰 제목',
        description: '쿠폰 설명',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Coupon Title',
        description: 'Coupon Description',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '优惠券标题',
        description: '优惠券描述',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventCouponLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventCouponLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventCouponStatus.NORMAL,
    enum: BrandPromotionEventCouponStatus,
  })
  @IsEnum(BrandPromotionEventCouponStatus)
  @IsDefined()
  status: BrandPromotionEventCouponStatus;

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: Date;

  static from(
    entity: BrandPromotionEventCouponEntity,
    language: GetAdminBrandPromotionEventCouponLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionEventId: entity.brandPromotionEventId,
      imageUrl: entity.getImageUrl(),
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PatchAdminBrandPromotionEventCouponRequest {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionEventId: number;

  @ApiProperty({
    description: '쿠폰 이미지 경로',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-promotion-event-coupons/2025-09-16/coupon-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionEventCouponLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '쿠폰 제목',
        description: '쿠폰 설명',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Coupon Title',
        description: 'Coupon Description',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '优惠券标题',
        description: '优惠券描述',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventCouponLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventCouponLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventCouponStatus.NORMAL,
    enum: BrandPromotionEventCouponStatus,
  })
  @IsEnum(BrandPromotionEventCouponStatus)
  @IsDefined()
  status: BrandPromotionEventCouponStatus;
}

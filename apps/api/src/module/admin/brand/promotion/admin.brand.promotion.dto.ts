import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../../admin.dto';
import {
  GetAdminBrandPromotionBannerResponse,
  PostAdminBrandPromotionBannerBaseDto,
} from './banner/admin.brand.promotion.banner.dto';
import {
  GetAdminBrandPromotionEventCouponResponse,
  GetAdminBrandPromotionEventResponse,
  PostAdminBrandPromotionEventBaseDto,
  PostAdminBrandPromotionEventCouponBaseDto,
} from './event/admin.brand.promotion.event.dto';
import { PostAdminBrandPromotionNoticsBaseDto } from './notics/admin.brand.promotion.notics.dto';
import {
  GetAdminBrandPromotionPopupResponse,
  PostAdminBrandPromotionPopupBaseDto,
} from './popup/admin.brand.promotion.popup.dto';
import {
  GetAdminBrandPromotionSectionResponse,
  PostAdminBrandPromotionSectionBaseDto,
} from './section/admin.brand.promotion.section.dto';

export class PostAdminBrandPromotionEventAndCouponDto {
  @ApiProperty({
    description: '이벤트',
    type: () => PostAdminBrandPromotionEventBaseDto,
  })
  @ValidateNested()
  @Type(() => PostAdminBrandPromotionEventBaseDto)
  @IsDefined()
  event: PostAdminBrandPromotionEventBaseDto;

  @ApiProperty({
    description: '쿠폰',
    type: () => PostAdminBrandPromotionEventCouponBaseDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionEventCouponBaseDto)
  @IsDefined()
  coupon: PostAdminBrandPromotionEventCouponBaseDto[];
}

export class GetAdminBrandPromotionEventAndCouponDto {
  @ApiProperty({
    description: '이벤트',
    type: () => GetAdminBrandPromotionEventResponse,
  })
  @ValidateNested()
  @Type(() => GetAdminBrandPromotionEventResponse)
  @IsDefined()
  event: GetAdminBrandPromotionEventResponse;

  @ApiProperty({
    description: '쿠폰',
    type: () => GetAdminBrandPromotionEventCouponResponse,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventCouponResponse)
  @IsDefined()
  coupon: GetAdminBrandPromotionEventCouponResponse[];

  static from(
    event: GetAdminBrandPromotionEventResponse,
    coupon: GetAdminBrandPromotionEventCouponResponse[],
  ) {
    return plainToInstance(this, {
      event,
      coupon,
    });
  }
}

export class PostAdminBrandPromotionLanguageDto {
  @ApiProperty({
    description: '언어 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '설명',
    example: '설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  static from(languageId: number, description: string) {
    return plainToInstance(this, {
      languageId,
      description,
    });
  }
}

export class GetAdminBrandPromotionLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '설명',
    example: '설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  static from(languageCode: LanguageCode, description: string) {
    return plainToInstance(this, {
      languageCode,
      description,
    });
  }
}

export class PostAdminBrandPromotionRequest {
  @ApiProperty({
    description: '브랜드 아이디',
    example: 7,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: () => PostAdminBrandPromotionLanguageDto,
    example: [
      {
        languageId: 1,
        description: '설명',
      },
      {
        languageId: 2,
        description: 'DESCRIPTION',
      },
      {
        languageId: 3,
        description: '중국어중국어',
      },
    ],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionLanguageDto)
  @IsDefined()
  language: PostAdminBrandPromotionLanguageDto[];

  @ApiPropertyOptional({
    description: '브랜드 프로모션 활성 여부',
    example: true,
    default: true,
  })
  @Transform(({ value }) =>
    value === undefined || value === null
      ? true
      : value === 'true' || value === true,
  )
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: '배너 목록',
    type: () => PostAdminBrandPromotionBannerBaseDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionBannerBaseDto)
  @IsDefined()
  bannerList: PostAdminBrandPromotionBannerBaseDto[];

  @ApiProperty({
    description: '섹션 목록',
    type: () => PostAdminBrandPromotionSectionBaseDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionSectionBaseDto)
  @IsDefined()
  sectionList: PostAdminBrandPromotionSectionBaseDto[];

  @ApiProperty({
    description: '팝업 목록',
    type: () => PostAdminBrandPromotionPopupBaseDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionPopupBaseDto)
  @IsDefined()
  popupList: PostAdminBrandPromotionPopupBaseDto[];

  @ApiPropertyOptional({
    description: '공지 목록',
    type: () => PostAdminBrandPromotionNoticsBaseDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionNoticsBaseDto)
  @IsOptional()
  noticeList: PostAdminBrandPromotionNoticsBaseDto[];

  @ApiPropertyOptional({
    description: '이벤트리스트와 이벤트별 쿠폰리스트',
    type: () => PostAdminBrandPromotionEventAndCouponDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionEventAndCouponDto)
  @IsOptional()
  eventAndCouponList?: PostAdminBrandPromotionEventAndCouponDto[];
}

export class GetAdminBrandPromotionDetailBrandDto {
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
    description: '언어별 내용',
    type: () => GetAdminBrandPromotionLanguageDto,
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        description: '설명',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        description: 'DESCRIPTION',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        description: '중국어중국어',
      },
    ],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionLanguageDto[];

  @ApiProperty({
    description: '브랜드 좋아요 수',
    example: 100,
  })
  @IsNumber()
  @IsDefined()
  likeCount: number;

  static from(
    entity: BrandEntity,
    language: GetAdminBrandPromotionLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      name: entity.englishName,
      profileImageUrl: entity.getProfileImage(),
      language,
      likeCount: Math.floor(Math.random() * 50001),
    });
  }
}

export class GetAdminBrandPromotionDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 정보',
    type: GetAdminBrandPromotionDetailBrandDto,
    example: {
      id: 1,
      name: '브랜드 이름',
      profileImageUrl: 'https://example.com/profile.jpg',
    },
  })
  @ValidateNested()
  @Type(() => GetAdminBrandPromotionDetailBrandDto)
  @IsDefined()
  brandDto: GetAdminBrandPromotionDetailBrandDto;

  @ApiProperty({
    description: '배너 목록',
    type: () => GetAdminBrandPromotionBannerResponse,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionBannerResponse)
  @IsDefined()
  bannerList: GetAdminBrandPromotionBannerResponse[];

  @ApiProperty({
    description: '섹션 목록',
    type: () => GetAdminBrandPromotionSectionResponse,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionSectionResponse)
  @IsDefined()
  sectionList: GetAdminBrandPromotionSectionResponse[];

  @ApiProperty({
    description: '팝업 목록',
    type: () => GetAdminBrandPromotionPopupResponse,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionPopupResponse)
  @IsDefined()
  popupList: GetAdminBrandPromotionPopupResponse[];

  @ApiPropertyOptional({
    description: '이벤트리스트와 이벤트별 쿠폰리스트',
    type: () => GetAdminBrandPromotionEventAndCouponDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventAndCouponDto)
  @IsOptional()
  eventAndCouponList?: GetAdminBrandPromotionEventAndCouponDto[];

  @ApiProperty({
    description: '브랜드 프로모션 활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  static from(
    entity: BrandPromotionEntity,
    bannerList: GetAdminBrandPromotionBannerResponse[],
    language: GetAdminBrandPromotionLanguageDto[],
    sectionList: GetAdminBrandPromotionSectionResponse[],
    popupList: GetAdminBrandPromotionPopupResponse[],
    eventAndCouponList?: GetAdminBrandPromotionEventAndCouponDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandDto: GetAdminBrandPromotionDetailBrandDto.from(
        entity.brand,
        language,
      ),
      isActive: entity.isActive,
      bannerList,
      sectionList,
      popupList,
      eventAndCouponList,
    });
  }
}

export class GetAdminBrandPromotionListRequest extends ListFilterDto {}

export class GetAdminBrandPromotionResponse {
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
    description: '브랜드 프로모션 활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

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

  static from(entity: BrandPromotionEntity) {
    return plainToInstance(this, {
      id: entity.id,
      brandId: entity.brandId,
      isActive: entity.isActive,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

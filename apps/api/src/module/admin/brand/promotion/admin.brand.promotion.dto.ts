import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { BrandPromotionEventStatus } from '@app/repository/enum/brand-promotion-event.enum';
import { BrandPromotionSectionType } from '@app/repository/enum/brand-promotion-section';
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
  AdminBrandPromotionBannerLanguageDto,
  GetAdminBrandPromotionBannerResponse,
  PostAdminBrandPromotionBannerBaseDto,
} from './banner/admin.brand.promotion.banner.dto';
import {
  GetAdminBrandPromotionEventCouponLanguageDto,
  GetAdminBrandPromotionEventCouponResponse,
  GetAdminBrandPromotionEventLanguageDto,
  GetAdminBrandPromotionEventResponse,
  PostAdminBrandPromotionEventBaseDto,
  PostAdminBrandPromotionEventCouponBaseDto,
} from './event/admin.brand.promotion.event.dto';
import {
  GetAdminBrandPromotionNoticeLanguageDto,
  GetAdminBrandPromotionNoticeResponse,
  PostAdminBrandPromotionNoticeBaseDto,
} from './notice/admin.brand.promotion.notice.dto';
import {
  GetAdminBrandPromotionPopupLanguageDto,
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
    description: '프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  promotionId: number;

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
  brandDescriptionLanguage: PostAdminBrandPromotionLanguageDto[];

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
    type: () => PostAdminBrandPromotionNoticeBaseDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionNoticeBaseDto)
  @IsOptional()
  noticeList: PostAdminBrandPromotionNoticeBaseDto[];

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
    description: '프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  promotionId: number;

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

  @ApiPropertyOptional({
    description: '공지 목록',
    type: () => GetAdminBrandPromotionNoticeResponse,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionNoticeResponse)
  @IsOptional()
  noticeList?: GetAdminBrandPromotionNoticeResponse[];

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
    noticeList?: GetAdminBrandPromotionNoticeResponse[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      promotionId: entity.promotionId,
      brandDto: GetAdminBrandPromotionDetailBrandDto.from(
        entity.brand,
        language,
      ),
      isActive: entity.isActive,
      bannerList,
      sectionList,
      popupList,
      eventAndCouponList,
      noticeList,
    });
  }
}

export class PatchAdminBrandPromotionBannerDto {
  @ApiProperty({
    description: '배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-promotion-banners/2025-09-16/banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 URL',
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
    description: '언어별 내용',
    type: [AdminBrandPromotionBannerLanguageDto],
    example: [
      { languageCode: LanguageCode.KOREAN, title: '제목' },
      { languageCode: LanguageCode.ENGLISH, title: 'TITLE' },
      { languageCode: LanguageCode.TAIWAN, title: '중국어 제목' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminBrandPromotionBannerLanguageDto)
  @IsDefined()
  language: AdminBrandPromotionBannerLanguageDto[];
}

export class PatchAdminBrandPromotionSectionDto {
  @ApiProperty({
    description: '브랜드 프로모션 섹션 타입',
    example: BrandPromotionSectionType.TYPE_1,
    enum: BrandPromotionSectionType,
  })
  @IsEnum(BrandPromotionSectionType)
  @IsDefined()
  type: BrandPromotionSectionType;

  @ApiProperty({
    description: '브랜드 프로모션 섹션 이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-promotion-sections/2025-09-16/section-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-sections/2025-09-16/section-02.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];
}

export class PatchAdminBrandPromotionPopupDto {
  @ApiProperty({ description: '장소', example: '장소' })
  @IsString()
  @IsDefined()
  place: string;

  @ApiProperty({ description: '주소', example: '주소' })
  @IsString()
  @IsDefined()
  address: string;

  @ApiProperty({ description: '위도', example: 37.5665 })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  latitude: number;

  @ApiProperty({ description: '경도', example: 127.036344 })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  longitude: number;

  @ApiProperty({ description: '시작일', example: '2025-01-01' })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({ description: '시작 시간', example: '10:00' })
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

  @ApiProperty({ description: '종료 시간', example: '20:00' })
  @IsString()
  @IsDefined()
  endTime: string;

  @ApiProperty({ description: '활성 여부', example: true })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionPopupLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '타이틀',
        description: '설명',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '중국어 타이틀',
        description: '중국어 설명',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionPopupLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionPopupLanguageDto[];

  @ApiProperty({
    description: '이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-01.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];
}

export class PatchAdminBrandPromotionNoticeDto {
  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionNoticeLanguageDto],
    example: [
      { languageCode: LanguageCode.KOREAN, content: '내용' },
      { languageCode: LanguageCode.ENGLISH, content: 'content' },
      { languageCode: LanguageCode.TAIWAN, content: '内容' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionNoticeLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionNoticeLanguageDto[];
}

export class PatchAdminBrandPromotionEventDto {
  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionEventLanguageDto],
    example: [
      { languageCode: LanguageCode.KOREAN, title: '제목' },
      { languageCode: LanguageCode.ENGLISH, title: 'Title' },
      { languageCode: LanguageCode.TAIWAN, title: '标题' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventLanguageDto[];
}

export class PatchAdminBrandPromotionEventCouponDto {
  @ApiProperty({
    description: '쿠폰 이미지 URL',
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
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventCouponLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventCouponLanguageDto[];
}

export class PatchAdminBrandPromotionEventAndCouponDto {
  @ApiProperty({
    description: '이벤트',
    type: () => PatchAdminBrandPromotionEventDto,
  })
  @ValidateNested()
  @Type(() => PatchAdminBrandPromotionEventDto)
  @IsDefined()
  event: PatchAdminBrandPromotionEventDto;

  @ApiProperty({
    description: '쿠폰',
    type: () => PatchAdminBrandPromotionEventCouponDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminBrandPromotionEventCouponDto)
  @IsDefined()
  coupon: PatchAdminBrandPromotionEventCouponDto[];
}

export class PatchAdminBrandPromotionRequest {
  @ApiProperty({
    description: '프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  promotionId: number;

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
    type: () => GetAdminBrandPromotionLanguageDto,
    example: [
      { languageCode: LanguageCode.KOREAN, description: '설명' },
      { languageCode: LanguageCode.ENGLISH, description: 'DESCRIPTION' },
      { languageCode: LanguageCode.TAIWAN, description: '중국어중국어' },
    ],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionLanguageDto)
  @IsDefined()
  brandDescriptionLanguage: GetAdminBrandPromotionLanguageDto[];

  @ApiProperty({
    description: '브랜드 프로모션 활성 여부',
    example: true,
  })
  @Transform(({ value }) =>
    value === undefined || value === null
      ? true
      : value === 'true' || value === true,
  )
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '배너 목록',
    type: () => PatchAdminBrandPromotionBannerDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminBrandPromotionBannerDto)
  @IsDefined()
  bannerList: PatchAdminBrandPromotionBannerDto[];

  @ApiProperty({
    description: '섹션 목록',
    type: () => PatchAdminBrandPromotionSectionDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminBrandPromotionSectionDto)
  @IsDefined()
  sectionList: PatchAdminBrandPromotionSectionDto[];

  @ApiProperty({
    description: '팝업 목록',
    type: () => PatchAdminBrandPromotionPopupDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminBrandPromotionPopupDto)
  @IsDefined()
  popupList: PatchAdminBrandPromotionPopupDto[];

  @ApiPropertyOptional({
    description: '공지 목록',
    type: () => PatchAdminBrandPromotionNoticeDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminBrandPromotionNoticeDto)
  @IsOptional()
  noticeList?: PatchAdminBrandPromotionNoticeDto[];

  @ApiPropertyOptional({
    description: '이벤트리스트와 이벤트별 쿠폰리스트',
    type: () => PatchAdminBrandPromotionEventAndCouponDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminBrandPromotionEventAndCouponDto)
  @IsOptional()
  eventAndCouponList?: PatchAdminBrandPromotionEventAndCouponDto[];
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
    description: '프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  promotionId: number;

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
      promotionId: entity.promotionId,
      brandId: entity.brandId,
      isActive: entity.isActive,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

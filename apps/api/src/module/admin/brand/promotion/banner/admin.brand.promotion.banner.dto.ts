import { Configuration } from '@app/config/configuration';
import { DeviceType } from '@app/repository/dto/common.dto';
import { BrandPromotionBannerEntity } from '@app/repository/entity/brand-promotion-banner.entity';
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

export class PostAdminBrandPromotionBannerLanguageDto {
  @ApiProperty({
    description: '언어 ID',
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

export class AdminBrandPromotionBannerLanguageDto {
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

export class PostAdminBrandPromotionBannerRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '배너 이미지 경로',
    example: '/brand-promotion-banners/2025-09-16/banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  imagePath: string;

  @ApiProperty({
    description: '모바일 배너 이미지 경로',
    example: '/brand-promotion-banners/2025-09-16/banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  mobileImagePath: string;

  @ApiProperty({
    description: '배너 링크 URL',
    example: 'https://example.com',
  })
  @IsString()
  @IsDefined()
  linkUrl: string;

  @ApiProperty({
    description: '언어별 내용',
    type: [PostAdminBrandPromotionBannerLanguageDto],
    example: [
      {
        languageId: 1,
        title: '제목',
      },
      {
        languageId: 2,
        title: 'TITLE',
      },
      {
        languageId: 3,
        title: '중국어 제목',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionBannerLanguageDto)
  @IsDefined()
  language: PostAdminBrandPromotionBannerLanguageDto[];
}

export class GetAdminBrandPromotionBannerRequest extends ListFilterDto {}

export class GetAdminBrandPromotionBannerResponse {
  @ApiProperty({
    description: '브랜드 프로모션 배너 아이디',
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

  @ApiProperty({
    description: '언어별 내용',
    type: [AdminBrandPromotionBannerLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminBrandPromotionBannerLanguageDto)
  @IsDefined()
  language: AdminBrandPromotionBannerLanguageDto[];

  static from(
    entity: BrandPromotionBannerEntity,
    language: AdminBrandPromotionBannerLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      imageUrl: entity.images
        .find((image) => image.deviceType === DeviceType.DESKTOP)
        ?.getImage(),
      mobileImageUrl: entity.images
        .find((image) => image.deviceType === DeviceType.MOBILE)
        ?.getImage(),
      linkUrl: entity.linkUrl,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
      language,
    });
  }
}

export class GetAdminBrandPromotionBannerDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 배너 아이디',
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

  @ApiProperty({
    description: '언어별 내용',
    type: [AdminBrandPromotionBannerLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'TITLE',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '중국어 제목',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminBrandPromotionBannerLanguageDto)
  @IsDefined()
  language: AdminBrandPromotionBannerLanguageDto[];

  static from(
    entity: BrandPromotionBannerEntity,
    language: AdminBrandPromotionBannerLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      imageUrl: entity.images
        .find((image) => image.deviceType === DeviceType.DESKTOP)
        ?.getImage(),
      mobileImageUrl: entity.images
        .find((image) => image.deviceType === DeviceType.MOBILE)
        ?.getImage(),
      linkUrl: entity.linkUrl,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
      language,
    });
  }
}

export class PatchAdminBrandPromotionBannerRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

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
    description: '언어별 내용',
    type: [AdminBrandPromotionBannerLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminBrandPromotionBannerLanguageDto)
  @IsDefined()
  language: AdminBrandPromotionBannerLanguageDto[];

  getImagePath(): string {
    return this.imageUrl.replace(
      Configuration.getConfig().IMAGE_DOMAIN_NAME,
      '',
    );
  }

  getMobileImagePath(): string {
    return this.mobileImageUrl.replace(
      Configuration.getConfig().IMAGE_DOMAIN_NAME,
      '',
    );
  }
}

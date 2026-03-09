import { Configuration } from '@app/config/configuration';
import { DeviceType } from '@app/repository/dto/common.dto';
import { BrandPromotionBannerEntity } from '@app/repository/entity/brand-promotion-banner.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsString } from 'class-validator';

import { ListFilterDto } from '../../../admin.dto';

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

  static from(entity: BrandPromotionBannerEntity) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      imagePath: entity.images
        .find((image) => image.deviceType === DeviceType.DESKTOP)
        ?.getImage(),
      mobileImagePath: entity.images
        .find((image) => image.deviceType === DeviceType.MOBILE)
        ?.getImage(),
      linkUrl: entity.linkUrl,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
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

  static from(entity: BrandPromotionBannerEntity) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      imagePath: entity.images
        .find((image) => image.deviceType === DeviceType.DESKTOP)
        ?.getImage(),
      mobileImagePath: entity.images
        .find((image) => image.deviceType === DeviceType.MOBILE)
        ?.getImage(),
      linkUrl: entity.linkUrl,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PatchAdminBrandPromotionBannerRequest {
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

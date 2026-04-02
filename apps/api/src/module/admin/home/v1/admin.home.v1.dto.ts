import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeBannerImageStatus } from '@app/repository/enum/home-banner-image.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class V1GetHomeBannerResponse {
  @ApiProperty({ description: '배너 이미지 ID', example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01.jpg',
  })
  @IsString()
  imageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01-mobile.jpg',
  })
  @IsString()
  mobileImageUrl: string;

  @ApiProperty({
    description: '배너 상태',
    example: HomeBannerImageStatus.NORMAL,
  })
  @IsEnum(HomeBannerImageStatus)
  status: HomeBannerImageStatus;

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  updateDate: Date;

  static from(entity: HomeBannerImageEntity) {
    return plainToInstance(this, {
      id: entity.id,
      imageUrl: entity.getImage(),
      mobileImageUrl: entity.getMobileImage(),
      status: entity.deleteDate
        ? HomeBannerImageStatus.DELETE
        : HomeBannerImageStatus.NORMAL,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class V1PostHomeBannerRequest {
  @ApiProperty({
    description: '배너 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01.jpg',
  })
  @IsString()
  @MaxLength(500)
  imageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01-mobile.jpg',
  })
  @IsString()
  @MaxLength(500)
  mobileImageUrl: string;
}

export class V1PatchHomeBannerRequest {
  @ApiPropertyOptional({
    description: '배너 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl: string;

  @ApiPropertyOptional({
    description: '모바일 배너 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01-mobile.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mobileImageUrl: string;
}

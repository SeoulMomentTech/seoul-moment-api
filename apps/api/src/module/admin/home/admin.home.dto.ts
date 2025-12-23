import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeBannerStatus } from '@app/repository/enum/home-banner-image.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class GetHomeBannerResponse {
  @ApiProperty({ description: '배너 이미지 ID', example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL',
    example: '/banner/banner.jpg',
  })
  @IsString()
  image: string;

  @ApiProperty({
    description: '모바일 배너 이미지 URL',
    example: '/banner/mobile-banner.jpg',
  })
  @IsString()
  mobileImage: string;

  @ApiProperty({
    description: '배너 상태',
    example: HomeBannerStatus.NORMAL,
  })
  @IsEnum(HomeBannerStatus)
  status: HomeBannerStatus;

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
      image: entity.getImage(),
      mobileImage: entity.getMobileImage(),
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PostHomeBannerRequest {
  @ApiProperty({
    description: '배너 이미지 URL',
    example: '/banner/banner.jpg',
  })
  @IsString()
  image: string;

  @ApiProperty({
    description: '모바일 배너 이미지 URL',
    example: '/banner/mobile-banner.jpg',
  })
  @IsString()
  mobileImage: string;
}

export class PatchHomeBannerRequest {
  @ApiPropertyOptional({
    description: '배너 이미지 URL',
    example: '/banner/banner.jpg',
  })
  @IsOptional()
  @IsString()
  image: string;

  @ApiPropertyOptional({
    description: '모바일 배너 이미지 URL',
    example: '/banner/mobile-banner.jpg',
  })
  @IsOptional()
  @IsString()
  mobileImage: string;
}

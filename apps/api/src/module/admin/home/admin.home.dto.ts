import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

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

  static from(entity: HomeBannerImageEntity) {
    return plainToInstance(this, {
      id: entity.id,
      image: entity.getImage(),
      mobileImage: entity.getMobileImage(),
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

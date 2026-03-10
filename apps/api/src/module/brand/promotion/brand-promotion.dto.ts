import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GetBrandPromotionResponse {
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

export class GetBrandPromotionDetailBannerDto {
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

  @ApiPropertyOptional({
    description: '배너 링크 URL',
    example: 'https://example.com',
  })
  @IsString()
  @IsOptional()
  linkUrl?: string;
}

export class GetBrandPromotionDetailBrandDto {
  @ApiProperty({
    description: '브랜드 이름',
    example: '브랜드 이름',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '브랜드 프로필 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '브랜드 설명',
    example:
      '즐거움을 지향하는 펀프롬펀은 키치하고 사랑스러운 디자인을 선보입니다. 위트 있고 독창적인 스타일로 입는 순간 또 다른 즐거움 경험해보세요.',
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
}

export class GetBrandPromotionDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 배너 목록',
    type: [GetBrandPromotionDetailBannerDto],
    example: [
      {
        id: 1,
        imageUrl:
          'https://image-dev.seoulmoment.com.tw/brand-promotion-banners/2025-09-16/banner-01.jpg',
        mobileImageUrl:
          'https://image-dev.seoulmoment.com.tw/brand-promotion-banners/2025-09-16/banner-01.jpg',
        linkUrl: 'https://example.com',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetBrandPromotionDetailBannerDto)
  @IsDefined()
  bannerList: GetBrandPromotionDetailBannerDto[];
}

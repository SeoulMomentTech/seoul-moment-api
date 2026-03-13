import { BrandPromotionSectionEntity } from '@app/repository/entity/brand-promotion-section.entity';
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
} from 'class-validator';

import { ListFilterDto } from '../../../admin.dto';

export class PostAdminBrandPromotionSectionBaseDto {
  @ApiProperty({
    description: '브랜드 프로모션 섹션 타입',
    example: BrandPromotionSectionType.TYPE_1,
    enum: BrandPromotionSectionType,
  })
  @IsEnum(BrandPromotionSectionType)
  @IsString()
  @IsDefined()
  type: BrandPromotionSectionType;

  @ApiProperty({
    description: '브랜드 프로모션 섹션 이미지 경로 리스트',
    example: [
      '/brand-promotion-sections/2025-09-16/section-01.jpg',
      '/brand-promotion-sections/2025-09-16/section-02.jpg',
      '/brand-promotion-sections/2025-09-16/section-03.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imagePathList: string[];
}

export class PostAdminBrandPromotionSectionRequest extends PostAdminBrandPromotionSectionBaseDto {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;
}
export class GetAdminBrandPromotionSectionResponse {
  @ApiProperty({
    description: '브랜드 프로모션 섹션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  brandPromotionId: number;

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
      brandPromotionId: entity.brandPromotionId,
      type: entity.type,
      imageUrlList: entity.images.map((image) => image.getImageUrl()),
    });
  }
}

export class GetAdminBrandPromotionSectionListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  brandPromotionId?: number;
}

export class GetAdminBrandPromotionSectionDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 섹션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '브랜드 프로모션 섹션 타입 아이디',
    example: BrandPromotionSectionType.TYPE_1,
    enum: BrandPromotionSectionType,
  })
  @IsEnum(BrandPromotionSectionType)
  @IsString()
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
      brandPromotionId: entity.brandPromotionId,
      type: entity.type,
      imageUrlList: entity.images.map((image) => image.getImageUrl()),
    });
  }
}

export class PatchAdminBrandPromotionSectionRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

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
}

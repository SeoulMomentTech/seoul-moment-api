import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../../admin.dto';

export class PostAdminBrandPromotionRequest {
  @ApiProperty({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandId: number;

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

  static from(entity: BrandEntity) {
    return plainToInstance(this, {
      id: entity.id,
      name: entity.englishName,
      profileImageUrl: entity.getProfileImage(),
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
    description: '브랜드 프로모션 활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  static from(entity: BrandPromotionEntity) {
    return plainToInstance(this, {
      id: entity.id,
      brandDto: GetAdminBrandPromotionDetailBrandDto.from(entity.brand),
      isActive: entity.isActive,
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
    description: '브랜드 프로모션 활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  static from(entity: BrandPromotionEntity) {
    return plainToInstance(this, {
      id: entity.id,
      brandDto: GetAdminBrandPromotionDetailBrandDto.from(entity.brand),
      isActive: entity.isActive,
    });
  }
}

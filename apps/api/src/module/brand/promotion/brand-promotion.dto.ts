import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNumber, IsString } from 'class-validator';

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

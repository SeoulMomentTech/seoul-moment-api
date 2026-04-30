import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsInt, IsPositive } from 'class-validator';

export class PostUserProductLikeRequest {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsDefined()
  productItemId: number;
}

export class PostUserBrandLikeRequest {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsDefined()
  brandId: number;
}

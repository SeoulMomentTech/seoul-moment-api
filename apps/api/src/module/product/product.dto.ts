import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

export class GetProductBannerResponse {
  @ApiProperty({
    description: '상품 배너',
    example: 'https://example.com/image1.jpg',
  })
  banner: string;

  static from(entity: ProductBannerEntity) {
    return plainToInstance(this, {
      banner: entity.getImage(),
    });
  }
}

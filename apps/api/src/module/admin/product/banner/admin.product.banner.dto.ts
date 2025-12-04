import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { ListFilterDto } from '../../admin.dto';

export class AdminProductBannerListRequest extends ListFilterDto {
  declare search?: string;
}

export class AdminProductBannerListResponse {
  @ApiProperty({
    description: '배너 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/product-banners/2025-09-16/product-banner-01.jpg',
  })
  imageUrl: string;

  static from(entity: ProductBannerEntity) {
    return plainToInstance(this, {
      id: entity.id,
      imageUrl: entity.getImage(),
    });
  }
}

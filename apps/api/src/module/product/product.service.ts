import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import { GetProductBannerResponse } from './product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  async getProductBanner(): Promise<GetProductBannerResponse[]> {
    const bannerList = await this.productRepositoryService.findBanner();

    return bannerList.map((v) => GetProductBannerResponse.from(v));
  }
}

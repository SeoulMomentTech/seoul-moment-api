import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  AdminProductBannerListRequest,
  AdminProductBannerListResponse,
} from './admin.product.banner.dto';

@Injectable()
export class AdminProductBannerService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  async getProductBannerList(
    request: AdminProductBannerListRequest,
  ): Promise<[AdminProductBannerListResponse[], number]> {
    const [productBannerEntities, total] =
      await this.productRepositoryService.findBannerByFilter(
        request.page,
        request.count,
        request.sort,
      );

    return [
      productBannerEntities.map((entity) =>
        AdminProductBannerListResponse.from(entity),
      ),
      total,
    ];
  }
}

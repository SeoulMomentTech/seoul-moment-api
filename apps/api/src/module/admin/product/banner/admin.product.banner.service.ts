import { UpdateProductBannerDto } from '@app/repository/dto/product.dto';
import { ProductBannerEntity } from '@app/repository/entity/product-banner.entity';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  AdminProductBannerListRequest,
  AdminProductBannerListResponse,
  GetAdminProductBannerDetailResponse,
  PatchAdminProductBannerSortOrderRequest,
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

  async postProductBanner(imageUrl: string, mobileImageUrl: string) {
    await this.productRepositoryService.insertBanner(
      plainToInstance(ProductBannerEntity, {
        image: imageUrl,
        mobileImage: mobileImageUrl,
      }),
    );
  }

  async patchProductBanner(
    id: number,
    imageUrl: string,
    mobileImageUrl: string,
  ) {
    const updateDto: UpdateProductBannerDto = {
      id,
      image: imageUrl,
      mobileImage: mobileImageUrl,
    };

    await this.productRepositoryService.updateBanner(updateDto);
  }

  async deleteProductBanner(id: number) {
    await this.productRepositoryService.deleteBanner(id);
  }

  async patchProductBannerSortOrder(
    request: PatchAdminProductBannerSortOrderRequest,
  ) {
    await this.productRepositoryService.bulkUpdateBannerSortOrder(
      request.list.map((item) =>
        plainToInstance(ProductBannerEntity, {
          id: item.id,
          sortOrder: item.sortOrder,
        }),
      ),
    );
  }

  async getProductBannerDetail(
    id: number,
  ): Promise<GetAdminProductBannerDetailResponse> {
    const productBannerEntity =
      await this.productRepositoryService.getBannerById(id);

    return GetAdminProductBannerDetailResponse.from(productBannerEntity);
  }
}

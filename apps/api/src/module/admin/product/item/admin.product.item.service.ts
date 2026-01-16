/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { ProductItemImageEntity } from '@app/repository/entity/product-item-image.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { VariantOptionEntity } from '@app/repository/entity/variant-option.entity';
import { ProductSortColumn } from '@app/repository/enum/product.enum';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  GetAdminProductItemRequest,
  GetAdminProductItemResponse,
  PostAdminProductItemRequest,
  PostAdminProductVariantRequest,
} from './admin.produict.item.dto';

@Injectable()
export class AdminProductItemService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly optionRepositoryService: OptionRepositoryService,
  ) {}

  async getAdminProductItem(
    request: GetAdminProductItemRequest,
  ): Promise<[GetAdminProductItemResponse[], number]> {
    const [productItems, count] =
      await this.productRepositoryService.findProductItem(
        PagingDto.from(request.page, request.count),
        ProductSortDto.from(ProductSortColumn.CREATE, request.sort),
        undefined,
        undefined,
        undefined,
        request.search,
      );

    return [
      productItems.map((productItem) =>
        GetAdminProductItemResponse.from(productItem),
      ),
      count,
    ];
  }

  async postAdminProductVariant(
    productItemId: number,
    dto: PostAdminProductVariantRequest[],
  ) {
    for (const variant of dto) {
      const skuExists =
        await this.productRepositoryService.existProductVariantBySku(
          variant.sku,
        );
      if (skuExists) {
        throw new ServiceError(
          `SKU가 이미 존재합니다.: ${variant.sku}`,
          ServiceErrorCode.CONFLICT,
        );
      }

      const productVariantEntity =
        await this.productRepositoryService.insertProductVariant(
          plainToInstance(ProductVariantEntity, {
            productItemId,
            sku: variant.sku,
            stockQuantity: variant.stockQuantity,
          }),
        );

      await Promise.all(
        variant.optionValueIdList.map(async (v) =>
          this.optionRepositoryService.getOptionValueByOptionValueId(v),
        ),
      );

      await this.optionRepositoryService.bulkInsertVariantOption(
        variant.optionValueIdList.map((v) =>
          plainToInstance(VariantOptionEntity, {
            variantId: productVariantEntity.id,
            optionValueId: v,
          }),
        ),
      );
    }
  }

  async postAdminProductItem(dto: PostAdminProductItemRequest) {
    await this.productRepositoryService.getProductByProductId(dto.productId);
    const productItemEntity =
      await this.productRepositoryService.insertProductItem(
        plainToInstance(ProductItemEntity, {
          productId: dto.productId,
          mainImageUrl: dto.mainImageUrl,
          price: dto.price,
          discountPrice: dto.discountPrice,
          shippingCost: dto.shippingCost,
          shippingInfo: dto.shippingInfo,
        }),
      );

    if (dto.imageUrlList && dto.imageUrlList.length > 0) {
      for (const imageUrl of dto.imageUrlList) {
        await this.productRepositoryService.insertProductItemImage(
          plainToInstance(ProductItemImageEntity, {
            productItemId: productItemEntity.id,
            imageUrl,
          }),
        );
      }
    }

    await this.postAdminProductVariant(productItemEntity.id, dto.variantList);
  }
}

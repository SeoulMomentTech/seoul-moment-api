/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { OptionValueDto } from '@app/repository/dto/option.dto';
import {
  ProductSortDto,
  UpdateProductItemDto,
} from '@app/repository/dto/product.dto';
import { ProductItemImageEntity } from '@app/repository/entity/product-item-image.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { VariantOptionEntity } from '@app/repository/entity/variant-option.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ProductSortColumn } from '@app/repository/enum/product.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminProductItemInfoResponse,
  GetAdminProductItemRequest,
  GetAdminProductItemResponse,
  PatchAdminProductItemRequest,
  PatchAdminProductVariantRequest,
  PostAdminProductItemRequest,
  PostAdminProductVariantRequest,
} from './admin.produict.item.dto';

@Injectable()
export class AdminProductItemService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly optionRepositoryService: OptionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
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

  @Transactional()
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

  @Transactional()
  async patchAdminProductVariant(
    productItemId: number,
    dto: PatchAdminProductVariantRequest[],
  ) {
    for (const variant of dto) {
      const skuExists =
        await this.productRepositoryService.existProductVariantBySkuAndId(
          variant.sku,
          productItemId,
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

  @Transactional()
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

  private async updateProductItemImage(
    productItemId: number,
    imageUrlList: string[],
  ) {
    await this.productRepositoryService.deleteProductItemImage(productItemId);

    if (imageUrlList && imageUrlList.length > 0) {
      for (const imageUrl of imageUrlList) {
        await this.productRepositoryService.insertProductItemImage(
          plainToInstance(ProductItemImageEntity, {
            productItemId,
            imageUrl,
          }),
        );
      }
    }
  }

  async getAdminProductItemInfo(
    productItemId: number,
  ): Promise<GetAdminProductItemInfoResponse> {
    const productItemEntity =
      await this.productRepositoryService.getProductItemById(productItemId);

    const allVariantOptions = productItemEntity.variants.flatMap(
      (variant) => variant.variantOptions,
    );

    const uniqueOptionValueIds = [
      ...new Set(allVariantOptions.map((vo) => vo.optionValueId)),
    ];

    const optionValueMap = new Map<number, OptionValueDto>();

    await Promise.all(
      uniqueOptionValueIds.map(async (optionValueId) => {
        const multilingualText =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.OPTION_VALUE,
            optionValueId,
            LanguageCode.KOREAN,
            'value',
          );

        const optionValueDto = OptionValueDto.from(
          optionValueId,
          multilingualText[0].textContent,
        );
        optionValueMap.set(optionValueId, optionValueDto);
      }),
    );

    const seenIds = new Set<number>();
    const productItemVariantList = allVariantOptions
      .map((variantOption) => optionValueMap.get(variantOption.optionValueId))
      .filter((value): value is OptionValueDto => {
        if (!value || seenIds.has(value.id)) {
          return false;
        }
        seenIds.add(value.id);
        return true;
      });

    return GetAdminProductItemInfoResponse.from(
      productItemEntity,
      productItemVariantList,
    );
  }

  @Transactional()
  async patchAdminProductItem(id: number, dto: PatchAdminProductItemRequest) {
    await this.productRepositoryService.getProductItemById(id);

    const updateDto: UpdateProductItemDto = {
      id,
      mainImageUrl: dto.mainImageUrl,
      price: dto.price,
      discountPrice: dto.discountPrice,
      shippingCost: dto.shippingCost,
      shippingInfo: dto.shippingInfo,
    };

    await this.productRepositoryService.updateProductItem(updateDto);

    if (dto.imageUrlList && dto.imageUrlList.length > 0) {
      await this.updateProductItemImage(id, dto.imageUrlList);
    }

    await this.productRepositoryService.deleteProductVariant(id);

    await this.patchAdminProductVariant(id, dto.variantList);
  }

  async deleteAdminProductItem(id: number) {
    await this.productRepositoryService.getProductItemById(id);
    await this.productRepositoryService.deleteProductItemById(id);
  }
}

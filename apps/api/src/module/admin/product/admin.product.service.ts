/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { Configuration } from '@app/config/configuration';
import {
  ProductSortDto,
  UpdateProductDto,
} from '@app/repository/dto/product.dto';
import { ProductEntity } from '@app/repository/entity/product.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminProductDetailResponse,
  GetAdminProductNameDto,
  GetAdminProductResponse,
  PatchAdminProductRequest,
  PostAdminProductRequest,
} from './admin.product.dto';

@Injectable()
export class AdminProductService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly categoryRepositoryService: CategoryRepositoryService,
  ) {}

  async getAdminProductList(
    pageDto: PagingDto,
    sortDto: ProductSortDto,
  ): Promise<[GetAdminProductResponse[], number]> {
    const [products, total] = await this.productRepositoryService.findProduct(
      pageDto,
      sortDto,
    );

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const productList = await Promise.all(
      products.map(async (product) => {
        const nameDto = await Promise.all(
          languages.map(async (language) => {
            const multilingualNameText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.PRODUCT,
                product.id,
                language.code,
                'name',
              );

            const multilingualOriginText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.PRODUCT,
                product.id,
                language.code,
                'origin',
              );

            if (
              multilingualNameText.length > 0 &&
              multilingualOriginText.length > 0
            ) {
              return GetAdminProductNameDto.from(
                language.code,
                multilingualNameText[0].textContent,
                multilingualOriginText[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminProductResponse.from(product, nameDto);
      }),
    );

    return [productList, total];
  }

  @Transactional()
  async postAdminProduct(dto: PostAdminProductRequest) {
    await Promise.all([
      this.brandRepositoryService.getBrandById(dto.brandId),
      this.categoryRepositoryService.getCategoryById(dto.categoryId),
      this.categoryRepositoryService.getProductCategoryById(
        dto.productCategoryId,
      ),
    ]);

    const productEntity = await this.productRepositoryService.insert(
      plainToInstance(ProductEntity, {
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        productCategoryId: dto.productCategoryId,
        detailInfoImageUrl: dto.detailInfoImageUrl,
      }),
    );

    for (const text of dto.text) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT,
        productEntity.id,
        'name',
        text.languageId,
        text.name,
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT,
        productEntity.id,
        'origin',
        text.languageId,
        text.origin,
      );
    }
  }

  async deleteAdminProduct(id: number) {
    await this.productRepositoryService.getProductByProductId(id);

    await this.productRepositoryService.delete(id);

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.PRODUCT,
      id,
    );
  }

  @Transactional()
  async patchAdminProduct(id: number, dto: PatchAdminProductRequest) {
    await this.productRepositoryService.getProductByProductId(id);

    if (dto.brandId) {
      await this.brandRepositoryService.getBrandById(dto.brandId);
    }
    if (dto.categoryId) {
      await this.categoryRepositoryService.getCategoryById(dto.categoryId);
    }
    if (dto.productCategoryId) {
      await this.categoryRepositoryService.getProductCategoryById(
        dto.productCategoryId,
      );
    }

    const updateDto: UpdateProductDto = {
      id,
      brandId: dto.brandId,
      categoryId: dto.categoryId,
      productCategoryId: dto.productCategoryId,
      detailInfoImageUrl: dto.detailInfoImageUrl.replace(
        Configuration.getConfig().IMAGE_DOMAIN_NAME,
        '',
      ),
      status: dto.status,
    };

    await this.productRepositoryService.update(updateDto);

    for (const text of dto.text) {
      if (text.name) {
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.PRODUCT,
          id,
          'name',
          text.languageId,
          text.name,
        );
      }
      if (text.origin) {
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.PRODUCT,
          id,
          'origin',
          text.languageId,
          text.origin,
        );
      }
    }
  }

  async getAdminProductDetail(
    id: number,
  ): Promise<GetAdminProductDetailResponse> {
    const productEntity =
      await this.productRepositoryService.getProductByProductId(id);

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const nameDto = await Promise.all(
      languages.map(async (language) => {
        const multilingualNameText =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.PRODUCT,
            productEntity.id,
            language.code,
            'name',
          );

        const multilingualOriginText =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.PRODUCT,
            productEntity.id,
            language.code,
            'origin',
          );

        if (
          multilingualNameText.length > 0 &&
          multilingualOriginText.length > 0
        ) {
          return GetAdminProductNameDto.from(
            language.code,
            multilingualNameText[0].textContent,
            multilingualOriginText[0].textContent,
          );
        }
        return null;
      }),
    );

    return GetAdminProductDetailResponse.from(productEntity, nameDto);
  }
}

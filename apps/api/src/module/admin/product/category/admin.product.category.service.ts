/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { UpdateProductCategoryDto } from '@app/repository/dto/product.dto';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminProductCategoryRequest,
  GetAdminProductCategoryResponse,
  PostAdminProductCategoryRequest,
  PatchAdminProductCategoryRequest,
  GetAdminProductCategoryInfoResponse,
  GetAdminProductCategoryNameDto,
} from './admin.product.category.dto';
import { GetAdminProductNameDto } from '../admin.product.dto';

@Injectable()
export class AdminProductCategoryService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly categoryRepositoryService: CategoryRepositoryService,
  ) {}

  async getAdminProductCategoryList(
    dto: GetAdminProductCategoryRequest,
  ): Promise<[GetAdminProductCategoryResponse[], number]> {
    const [productCategoryEntities, total] =
      await this.productRepositoryService.findCategoryWithFilter(
        PagingDto.from(dto.page, dto.count),
      );

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const productCategoryList = await Promise.all(
      productCategoryEntities.map(async (productCategoryEntity) => {
        const nameDto = await Promise.all(
          languages.map(async (language) => {
            const multilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.PRODUCT_CATEGORY,
                productCategoryEntity.id,
                language.code,
                'name',
              );

            const multilingualOriginText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.PRODUCT_CATEGORY,
                productCategoryEntity.id,
                language.code,
                'origin',
              );

            if (
              multilingualText.length > 0 &&
              multilingualOriginText.length > 0
            ) {
              return GetAdminProductNameDto.from(
                language.code,
                multilingualText[0].textContent,
                multilingualOriginText[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminProductCategoryResponse.from(
          productCategoryEntity,
          nameDto,
        );
      }),
    );

    return [productCategoryList, total];
  }

  @Transactional()
  async postAdminProductCategory(dto: PostAdminProductCategoryRequest) {
    await this.categoryRepositoryService.getCategoryById(dto.categoryId);

    const productCategoryEntity =
      await this.categoryRepositoryService.insertProductCategory(
        plainToInstance(ProductCategoryEntity, {
          categoryId: dto.categoryId,
          imageUrl: dto.imageUrl,
        }),
      );

    for (const text of dto.list) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_CATEGORY,
        productCategoryEntity.id,
        'name',
        text.languageId,
        text.name,
      );
    }
  }

  @Transactional()
  async deleteAdminProductCategory(id: number) {
    await this.categoryRepositoryService.deleteProductCategory(id);

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.PRODUCT_CATEGORY,
      id,
    );
  }

  async patchAdminProductCategory(
    id: number,
    dto: PatchAdminProductCategoryRequest,
  ) {
    if (dto.categoryId) {
      await this.categoryRepositoryService.getCategoryById(dto.categoryId);
    }

    const updateDto: UpdateProductCategoryDto = {
      id,
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl,
    };

    await this.categoryRepositoryService.updateProductCategory(updateDto);

    if (dto.list && dto.list.length > 0) {
      for (const text of dto.list) {
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.PRODUCT_CATEGORY,
          id,
          'name',
          text.languageId,
          text.name,
        );
      }
    }
  }

  async getAdminProductCategoryInfo(
    id: number,
  ): Promise<GetAdminProductCategoryInfoResponse> {
    const productCategoryEntity =
      await this.categoryRepositoryService.getProductCategoryById(id);

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const nameDto = await Promise.all(
      languages.map(async (language) => {
        const multilingualText =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.PRODUCT_CATEGORY,
            productCategoryEntity.id,
            language.code,
            'name',
          );

        if (multilingualText.length > 0) {
          return GetAdminProductCategoryNameDto.from(
            language.code,
            multilingualText[0].textContent,
          );
        }

        return null;
      }),
    );

    return GetAdminProductCategoryInfoResponse.from(
      nameDto,
      productCategoryEntity,
    );
  }
}

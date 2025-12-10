import { PagingDto } from '@app/common/dto/global.dto';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetAdminProductCategoryRequest,
  GetAdminProductCategoryResponse,
} from './admin.product.category.dto';
import { GetAdminProductNameDto } from '../admin.product.dto';

@Injectable()
export class AdminProductCategoryService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
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
            if (multilingualText.length > 0) {
              return GetAdminProductNameDto.from(
                language.code,
                multilingualText[0].textContent,
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
}

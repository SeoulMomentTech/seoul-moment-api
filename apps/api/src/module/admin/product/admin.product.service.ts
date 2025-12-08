import { PagingDto } from '@app/common/dto/global.dto';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetAdminProductNameDto,
  GetAdminProductResponse,
} from './admin.product.dto';

@Injectable()
export class AdminProductService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
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
            const multilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.PRODUCT,
                product.id,
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
        return GetAdminProductResponse.from(product, nameDto);
      }),
    );

    return [productList, total];
  }
}

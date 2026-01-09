/* eslint-disable max-lines-per-function */
import { LoggerService } from '@app/common/log/logger.service';
import { OpensearchService as ExternalOpensearchService } from '@app/external/opensearch/opensearch.service';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ProductItemStatus } from '@app/repository/enum/product.enum';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { GetProductRequest } from 'apps/api/src/module/product/product.dto';
import { ProductService } from 'apps/api/src/module/product/product.service';

import { ProductIndexDocument } from './opensearch.dto';

@Injectable()
export class OpensearchService {
  constructor(
    private readonly opensearchService: ExternalOpensearchService,
    private readonly productRepository: ProductRepositoryService,
    private readonly productService: ProductService,
    private readonly logger: LoggerService,
  ) {}

  async syncProductData() {
    const productIndexDocuments: ProductIndexDocument[] = [];

    const itemCount = await this.productRepository.getProductItemCount(
      ProductItemStatus.NORMAL,
    );
    const languages = Object.values(LanguageCode);

    const productDataByLanguage = new Map(
      await Promise.all(
        languages.map(async (languageCode) => {
          const [productItemList] = await this.productService.getProduct(
            GetProductRequest.from(1, itemCount),
            languageCode,
          );
          const productEntity =
            await this.productRepository.getProductItemByProductItemId(
              productItemList[0].id,
            );

          return [languageCode, { productItemList, productEntity }] as const;
        }),
      ),
    );
    for (
      let i = 0;
      i < productDataByLanguage.get(LanguageCode.KOREAN).productItemList.length;
      i++
    ) {
      productIndexDocuments.push(
        ProductIndexDocument.from(
          productDataByLanguage.get(LanguageCode.KOREAN).productEntity,
          productDataByLanguage.get(LanguageCode.KOREAN).productItemList[i],
          productDataByLanguage.get(LanguageCode.ENGLISH).productItemList[i],
          productDataByLanguage.get(LanguageCode.TAIWAN).productItemList[i],
        ),
      );
    }

    this.logger.info('🔍 Sync product data', {
      productIndexDocuments,
    });

    await this.opensearchService.bulk('products', productIndexDocuments);
  }
}

import { LanguageCode } from '@app/repository/enum/language.enum';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  V1GetProductDetailResponse,
  V1GetProductDetailVariant,
} from './v1.product.dto';
import { ProductService } from '../product.service';

@Injectable()
export class V1ProductService {
  constructor(
    private readonly productService: ProductService,
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  /**
   * 기존 상세 조회를 그대로 쓰고 옵션 조합(SKU)만 얹는다.
   * v0 로직을 복사하지 않아야 두 버전이 서로 어긋나지 않는다.
   */
  async getProductDetail(
    productItemId: number,
    language: LanguageCode,
    userId?: number,
  ): Promise<V1GetProductDetailResponse> {
    const base = await this.productService.getProductDetail(
      productItemId,
      language,
      userId,
    );

    const variants =
      await this.productRepositoryService.findVariantsByProductItemId(
        productItemId,
      );

    return V1GetProductDetailResponse.from(
      base,
      V1GetProductDetailVariant.fromList(variants),
    );
  }
}

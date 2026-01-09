import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { OptionType } from '@app/repository/enum/product.enum';
import { GetProductResponse } from 'apps/api/src/module/product/product.dto';
import { plainToInstance } from 'class-transformer';

export class ProductIndexDocument {
  id: number;
  brandId: number;
  categoryId: number;
  productCategoryId: number;

  colorCode: string;

  brandNameKo: string;
  brandNameEn: string;
  brandNameZh: string;

  colorNameKo: string;
  colorNameEn: string;
  colorNameZh: string;

  nameKo: string;
  nameEn: string;
  nameZh: string;

  image: string;

  price: number;

  review: number;
  reviewAverage: number;

  like: number;

  optionIdList: number[];

  createdAt: Date;

  static from(
    entity: ProductItemEntity,
    productItemKo: GetProductResponse,
    productItemEn: GetProductResponse,
    productItemZh: GetProductResponse,
  ) {
    return plainToInstance(this, {
      id: productItemKo.id,
      brandId: entity.product.brandId,
      categoryId: entity.product.categoryId,
      productCategoryId: entity.product.productCategoryId,
      colorCode:
        entity.variants.flatMap((v) =>
          v.variantOptions
            .filter((v) => v.optionValue.option.type === OptionType.COLOR)
            .map((v) => v.optionValue.colorCode),
        )[0] || null,

      brandNameKo: productItemKo.brandName,
      brandNameEn: productItemEn.brandName,
      brandNameZh: productItemZh.brandName,

      colorNameKo: productItemKo.colorName,
      colorNameEn: productItemEn.colorName,
      colorNameZh: productItemZh.colorName,

      nameKo: productItemKo.productName,
      nameEn: productItemEn.productName,
      nameZh: productItemZh.productName,

      image: entity.getMainImage(),

      price: entity.getEffectivePrice(),
      like: Math.floor(Math.random() * 50001),
      review: Math.floor(Math.random() * 10001),
      reviewAverage: Math.round(Math.random() * 5 * 10) / 10,

      optionIdList: entity.variants.flatMap((v) =>
        v.variantOptions.map((v) => v.optionValue.id),
      ),

      createdAt: entity.createDate,
    });
  }
}

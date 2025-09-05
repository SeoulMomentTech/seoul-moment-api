import { BrandEntity } from '@app/repository/entity/brand.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { OptionValueEntity } from '@app/repository/entity/option-value.entity';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductColorImageEntity } from '@app/repository/entity/product-color-image.entity';
import { ProductColorEntity } from '@app/repository/entity/product-color.entity';
import { ProductImageEntity } from '@app/repository/entity/product-image.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { ProductEntity } from '@app/repository/entity/product.entity';
import { VariantOptionEntity } from '@app/repository/entity/variant-option.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  OptionType,
  ProductImageType,
  ProductStatus,
  ProductVariantStatus,
} from '@app/repository/enum/product.enum';
import { DataSource } from 'typeorm';

import { BrandFactory } from './brand.factory';
import { LanguageFactory } from './language.factory';

export class ProductFactory {
  private brandFactory: BrandFactory;
  private languageFactory: LanguageFactory;

  constructor(private dataSource: DataSource) {
    this.brandFactory = new BrandFactory(dataSource);
    this.languageFactory = new LanguageFactory(dataSource);
  }

  /**
   * 상품 카테고리 생성
   */
  async createProductCategory(
    overrides: Partial<ProductCategoryEntity> = {},
  ): Promise<ProductCategoryEntity> {
    const categoryRepository = this.dataSource.getRepository(
      ProductCategoryEntity,
    );

    const category = categoryRepository.create({
      sortOrder: 1,
      ...overrides,
    });

    return categoryRepository.save(category);
  }

  /**
   * 기본 상품 생성
   */
  async createProduct(
    brand: BrandEntity,
    overrides: Partial<ProductEntity> = {},
  ): Promise<ProductEntity> {
    const productRepository = this.dataSource.getRepository(ProductEntity);

    const product = productRepository.create({
      brandId: brand.id,
      status: ProductStatus.NORMAL,
      ...overrides,
    });

    return productRepository.save(product);
  }

  /**
   * 상품 갤러리 이미지 생성
   */
  async createProductImage(
    product: ProductEntity,
    overrides: Partial<ProductImageEntity> = {},
  ): Promise<ProductImageEntity> {
    const imageRepository = this.dataSource.getRepository(ProductImageEntity);

    const image = imageRepository.create({
      productId: product.id,
      imageUrl: 'https://example.com/product-image.jpg',
      imageType: ProductImageType.GALLERY,
      sortOrder: 1,
      ...overrides,
    });

    return imageRepository.save(image);
  }

  /**
   * 옵션 생성
   */
  async createOption(
    overrides: Partial<OptionEntity> = {},
  ): Promise<OptionEntity> {
    const optionRepository = this.dataSource.getRepository(OptionEntity);

    const option = optionRepository.create({
      type: OptionType.COLOR,
      sortOrder: 1,
      isActive: true,
      ...overrides,
    });

    return optionRepository.save(option);
  }

  /**
   * 옵션값 생성
   */
  async createOptionValue(
    option: OptionEntity,
    overrides: Partial<OptionValueEntity> = {},
  ): Promise<OptionValueEntity> {
    const valueRepository = this.dataSource.getRepository(OptionValueEntity);

    const optionValue = valueRepository.create({
      optionId: option.id,
      sortOrder: 1,
      isActive: true,
      ...overrides,
    });

    return valueRepository.save(optionValue);
  }

  /**
   * 상품 변형(ProductVariant) 생성
   */
  async createProductVariant(
    product: ProductEntity,
    overrides: Partial<ProductVariantEntity> = {},
  ): Promise<ProductVariantEntity> {
    const variantRepository =
      this.dataSource.getRepository(ProductVariantEntity);

    const variant = variantRepository.create({
      productId: product.id,
      sku: `SKU-${Date.now()}`,
      stockQuantity: 10,
      isActive: true,
      status: ProductVariantStatus.ACTIVE,
      ...overrides,
    });

    return variantRepository.save(variant);
  }

  /**
   * 변형-옵션값 연결 생성
   */
  async createVariantOption(
    variant: ProductVariantEntity,
    optionValue: OptionValueEntity,
  ): Promise<VariantOptionEntity> {
    const variantOptionRepository =
      this.dataSource.getRepository(VariantOptionEntity);

    const variantOption = variantOptionRepository.create({
      variantId: variant.id,
      optionValueId: optionValue.id,
    });

    return variantOptionRepository.save(variantOption);
  }

  /**
   * 상품-색상 연결 생성
   */
  async createProductColor(
    product: ProductEntity,
    optionValue: OptionValueEntity,
    overrides: Partial<ProductColorEntity> = {},
  ): Promise<ProductColorEntity> {
    const productColorRepository =
      this.dataSource.getRepository(ProductColorEntity);

    const productColor = productColorRepository.create({
      productId: product.id,
      optionValueId: optionValue.id,
      price: 59000,
      ...overrides,
    });

    return productColorRepository.save(productColor);
  }

  /**
   * 상품 색상 이미지 생성
   */
  async createProductColorImage(
    productColor: ProductColorEntity,
    overrides: Partial<ProductColorImageEntity> = {},
  ): Promise<ProductColorImageEntity> {
    const repository = this.dataSource.getRepository(ProductColorImageEntity);

    const image = repository.create({
      productColorId: productColor.productId, // ProductColorEntity는 복합키이므로 적절한 방식으로 참조
      imageUrl: 'https://example.com/color-image.jpg',
      sortOrder: 1,
      ...overrides,
    });

    return repository.save(image);
  }

  /**
   * 다국어 상품 카테고리 생성
   */
  async createMultilingualProductCategory(
    categoryData: Partial<ProductCategoryEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
    },
  ): Promise<{
    category: ProductCategoryEntity;
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
    texts: MultilingualTextEntity[];
  }> {
    // 카테고리 생성
    const category = await this.createProductCategory(categoryData);

    // 언어 생성
    const languages = await this.languageFactory.createDefaultLanguages();

    // 다국어 텍스트 생성
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.name) {
      for (const [langCode, content] of Object.entries(multilingualData.name)) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.PRODUCT_CATEGORY,
            category.id,
            'name',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    return { category, languages, texts };
  }

  /**
   * 다국어 상품 생성
   */
  async createMultilingualProduct(
    brand: BrandEntity,
    productData: Partial<ProductEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
      description?: { [key in LanguageCode]?: string };
    },
  ): Promise<{
    product: ProductEntity;
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
    texts: MultilingualTextEntity[];
  }> {
    // 상품 생성
    const product = await this.createProduct(brand, productData);

    // 언어 생성
    const languages = await this.languageFactory.createDefaultLanguages();

    // 다국어 텍스트 생성
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.name) {
      for (const [langCode, content] of Object.entries(multilingualData.name)) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.PRODUCT,
            product.id,
            'name',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    if (multilingualData?.description) {
      for (const [langCode, content] of Object.entries(
        multilingualData.description,
      )) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.PRODUCT,
            product.id,
            'description',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    return { product, languages, texts };
  }

  /**
   * 다국어 옵션값 생성
   */
  async createMultilingualOptionValue(
    option: OptionEntity,
    optionValueData: Partial<OptionValueEntity> = {},
    multilingualData?: {
      value?: { [key in LanguageCode]?: string };
    },
  ): Promise<{
    optionValue: OptionValueEntity;
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
    texts: MultilingualTextEntity[];
  }> {
    // 옵션값 생성
    const optionValue = await this.createOptionValue(option, optionValueData);

    // 언어 생성
    const languages = await this.languageFactory.createDefaultLanguages();

    // 다국어 텍스트 생성
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.value) {
      for (const [langCode, content] of Object.entries(
        multilingualData.value,
      )) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.OPTION_VALUE,
            optionValue.id,
            'value',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    return { optionValue, languages, texts };
  }

  /**
   * 완전한 상품 데이터 생성 (복잡한 옵션 조합 포함)
   * - 상품 + 이미지 + 옵션 + 변형 모두 생성
   */
  async createFullProduct(options: {
    brand?: BrandEntity;
    product?: Partial<ProductEntity>;
    images?: Array<{
      imageType: ProductImageType;
      imageUrl: string;
      sortOrder: number;
    }>;
    options?: Array<{
      type: OptionType;
      name: { [key in LanguageCode]?: string };
      values: Array<{
        value: { [key in LanguageCode]?: string };
        colorCode?: string;
      }>;
    }>;
    variants?: Array<{
      sku: string;
      stockQuantity: number;
      optionValueIds: number[]; // 이 변형에 연결될 옵션값 ID들
    }>;
  }): Promise<{
    product: ProductEntity;
    images: ProductImageEntity[];
    options: Array<{
      option: OptionEntity;
      values: OptionValueEntity[];
    }>;
    variants: ProductVariantEntity[];
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
  }> {
    // 브랜드 생성 (제공되지 않은 경우)
    const brand = options.brand || (await this.brandFactory.createBrand());

    // 언어 생성
    const languages = await this.languageFactory.createDefaultLanguages();

    // 1. 상품 생성
    const product = await this.createProduct(brand, options.product || {});

    // 2. 상품 이미지들 생성
    const images: ProductImageEntity[] = [];
    if (options.images) {
      for (const imageData of options.images) {
        const image = await this.createProductImage(product, {
          imageType: imageData.imageType,
          imageUrl: imageData.imageUrl,
          sortOrder: imageData.sortOrder,
        });
        images.push(image);
      }
    }

    // 3. 옵션들과 옵션값들 생성
    const optionsResult: Array<{
      option: OptionEntity;
      values: OptionValueEntity[];
    }> = [];

    if (options.options) {
      for (const optionData of options.options) {
        // 옵션 생성
        const option = await this.createOption({ type: optionData.type });

        // 옵션 이름 다국어 텍스트 생성
        for (const [langCode, content] of Object.entries(optionData.name)) {
          const language = Object.values(languages).find(
            (l) => l.code === langCode,
          );
          if (language && content) {
            await this.languageFactory.createMultilingualText(
              EntityType.OPTION,
              option.id,
              'name',
              language,
              content,
            );
          }
        }

        // 옵션값들 생성
        const values: OptionValueEntity[] = [];
        for (const valueData of optionData.values) {
          const optionValue = await this.createOptionValue(option, {
            colorCode: valueData.colorCode,
          });

          // 옵션값 다국어 텍스트 생성
          for (const [langCode, content] of Object.entries(valueData.value)) {
            const language = Object.values(languages).find(
              (l) => l.code === langCode,
            );
            if (language && content) {
              await this.languageFactory.createMultilingualText(
                EntityType.OPTION_VALUE,
                optionValue.id,
                'value',
                language,
                content,
              );
            }
          }

          values.push(optionValue);
        }

        optionsResult.push({ option, values });
      }
    }

    // 4. 상품 변형들 생성
    const variants: ProductVariantEntity[] = [];
    if (options.variants) {
      for (const variantData of options.variants) {
        const variant = await this.createProductVariant(product, {
          sku: variantData.sku,
          stockQuantity: variantData.stockQuantity,
        });

        // 변형-옵션값 연결 생성
        for (const optionValueId of variantData.optionValueIds) {
          // 먼저 해당 ID의 옵션값을 찾기
          const optionValue = optionsResult
            .flatMap((or) => or.values)
            .find((ov) => ov.id === optionValueId);

          if (optionValue) {
            await this.createVariantOption(variant, optionValue);
          }
        }

        variants.push(variant);
      }
    }

    return {
      product,
      images,
      options: optionsResult,
      variants,
      languages,
    };
  }

  /**
   * 색상별 상품 리스트 테스트용 데이터 생성
   * - 여러 색상을 가진 상품들을 생성하여 색상별 리스트 기능 테스트
   */
  async createProductsForColorList(brand?: BrandEntity): Promise<{
    products: ProductEntity[];
    colorOptions: OptionValueEntity[];
    variants: ProductVariantEntity[];
  }> {
    const testBrand = brand || (await this.brandFactory.createBrand());

    // 색상 옵션 생성
    const colorOption = await this.createOption({ type: OptionType.COLOR });

    // 색상값들 생성
    const colors = [
      { name: '빨강', code: '#FF0000' },
      { name: '파랑', code: '#0000FF' },
      { name: '검정', code: '#000000' },
    ];

    const colorValues: OptionValueEntity[] = [];
    for (const color of colors) {
      const optionValue = await this.createOptionValue(colorOption, {
        colorCode: color.code,
      });
      colorValues.push(optionValue);
    }

    // 상품들 생성 (각각 여러 색상 보유)
    const products: ProductEntity[] = [];
    const variants: ProductVariantEntity[] = [];

    for (let i = 1; i <= 3; i++) {
      const product = await this.createProduct(testBrand, {});
      products.push(product);

      // 각 상품에 대해 모든 색상의 변형 생성
      for (const colorValue of colorValues) {
        const variant = await this.createProductVariant(product, {
          sku: `PROD${i}-${colorValue.colorCode}`,
          stockQuantity: 10 + i,
        });

        await this.createVariantOption(variant, colorValue);
        variants.push(variant);
      }
    }

    return {
      products,
      colorOptions: colorValues,
      variants,
    };
  }
}

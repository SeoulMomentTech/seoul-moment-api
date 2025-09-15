import { ArticleSectionImageEntity } from '@app/repository/entity/article-section-image.entity';
import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { CategoryEntity } from '@app/repository/entity/category.entity';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeSectionImageEntity } from '@app/repository/entity/home-section-image.entity';
import { HomeSectionEntity } from '@app/repository/entity/home-section.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsSectionImageEntity } from '@app/repository/entity/news-section-image.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { OptionValueEntity } from '@app/repository/entity/option-value.entity';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { PartnerCategoryEntity } from '@app/repository/entity/partner-category.entity';
import { PartnerEntity } from '@app/repository/entity/partner.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductColorImageEntity } from '@app/repository/entity/product-color-image.entity';
import { ProductColorEntity } from '@app/repository/entity/product-color.entity';
import { ProductImageEntity } from '@app/repository/entity/product-image.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { ProductEntity } from '@app/repository/entity/product.entity';
import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  ProductImageType,
  OptionType,
} from '@app/repository/enum/product.enum';
import { DataSource } from 'typeorm';

import { ArticleFactory } from './factories/article.factory';
import { BrandFactory } from './factories/brand.factory';
import { CategoryFactory } from './factories/category.factory';
import { HomeFactory } from './factories/home.factory';
import { LanguageFactory } from './factories/language.factory';
import { NewsFactory } from './factories/news.factory';
import { PartnerFactory } from './factories/partner.factory';
import { ProductFactory } from './factories/product.factory';

export class TestDataFactory {
  public readonly brandFactory: BrandFactory;
  public readonly languageFactory: LanguageFactory;
  public readonly categoryFactory: CategoryFactory;
  public readonly articleFactory: ArticleFactory;
  public readonly newsFactory: NewsFactory;
  public readonly homeFactory: HomeFactory;
  public readonly partnerFactory: PartnerFactory;
  public readonly productFactory: ProductFactory;

  constructor(private dataSource: DataSource) {
    this.brandFactory = new BrandFactory(dataSource);
    this.languageFactory = new LanguageFactory(dataSource);
    this.categoryFactory = new CategoryFactory(dataSource);
    this.articleFactory = new ArticleFactory(dataSource);
    this.newsFactory = new NewsFactory(dataSource);
    this.homeFactory = new HomeFactory(dataSource);
    this.partnerFactory = new PartnerFactory(dataSource);
    this.productFactory = new ProductFactory(dataSource);
  }

  // ================================
  // Brand-related methods - delegating to BrandFactory
  // ================================
  async createBrand(
    overrides: Parameters<BrandFactory['createBrand']>[0] = {},
  ) {
    return this.brandFactory.createBrand(overrides);
  }

  async createBannerImage(
    brand: Parameters<BrandFactory['createBannerImage']>[0],
    overrides: Parameters<BrandFactory['createBannerImage']>[1] = {},
  ) {
    return this.brandFactory.createBannerImage(brand, overrides);
  }

  async createBrandSection(
    brand: Parameters<BrandFactory['createBrandSection']>[0],
    overrides: Parameters<BrandFactory['createBrandSection']>[1] = {},
  ) {
    return this.brandFactory.createBrandSection(brand, overrides);
  }

  async createSectionImage(
    section: Parameters<BrandFactory['createSectionImage']>[0],
    overrides: Parameters<BrandFactory['createSectionImage']>[1] = {},
  ) {
    return this.brandFactory.createSectionImage(section, overrides);
  }

  // 오버로드 메서드 직접 정의
  async createFullBrand(options?: {
    brand?: Partial<BrandEntity>;
    bannerCount?: number;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<BrandEntity>;

  async createFullBrand(options: {
    brand?: Partial<BrandEntity>;
    banners?: Array<{ sortOrder: number; imageUrl: string }>;
    sections?: Array<{
      sortOrder: number;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<BrandEntity>;

  async createFullBrand(options: any = {}): Promise<BrandEntity> {
    return this.brandFactory.createFullBrand(options);
  }

  async createBrandsWithDifferentStatuses() {
    return this.brandFactory.createBrandsWithDifferentStatuses();
  }

  async createMultilingualBrand(
    brandData: Parameters<BrandFactory['createMultilingualBrand']>[0] = {},
    multilingualData?: Parameters<BrandFactory['createMultilingualBrand']>[1],
  ) {
    return this.brandFactory.createMultilingualBrand(
      brandData,
      multilingualData,
    );
  }

  // ================================
  // Language-related methods - delegating to LanguageFactory
  // ================================
  async createLanguage(overrides: Partial<LanguageEntity> = {}) {
    return this.languageFactory.createLanguage(overrides);
  }

  async createMultilingualText(
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    language: LanguageEntity,
    textContent: string,
    overrides: Partial<MultilingualTextEntity> = {},
  ) {
    return this.languageFactory.createMultilingualText(
      entityType,
      entityId,
      fieldName,
      language,
      textContent,
      overrides,
    );
  }

  async createLanguages() {
    return this.languageFactory.createLanguages();
  }

  async createDefaultLanguages() {
    return this.languageFactory.createDefaultLanguages();
  }

  // ================================
  // Category-related methods - delegating to CategoryFactory
  // ================================
  async createCategory(overrides: Partial<CategoryEntity> = {}) {
    return this.categoryFactory.createCategory(overrides);
  }

  async createCategoryEntity(overrides: Partial<CategoryEntity> = {}) {
    return this.categoryFactory.createCategoryEntity(overrides);
  }

  async createMultilingualCategory(
    categoryData: Partial<CategoryEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
    },
  ) {
    return this.categoryFactory.createMultilingualCategory(
      categoryData,
      multilingualData,
    );
  }

  // ================================
  // Article-related methods - delegating to ArticleFactory
  // ================================
  async createArticle(
    category: CategoryEntity,
    brand?: BrandEntity,
    overrides: Partial<ArticleEntity> = {},
  ) {
    return this.articleFactory.createArticle(category, brand, overrides);
  }

  async createArticleSection(
    article: ArticleEntity,
    overrides: Partial<ArticleSectionEntity> = {},
  ) {
    return this.articleFactory.createArticleSection(article, overrides);
  }

  async createArticleSectionImage(
    section: ArticleSectionEntity,
    overrides: Partial<ArticleSectionImageEntity> = {},
  ) {
    return this.articleFactory.createArticleSectionImage(section, overrides);
  }

  async createFullArticle(options?: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    article?: Partial<ArticleEntity>;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<ArticleEntity>;

  async createFullArticle(options: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    article?: Partial<ArticleEntity>;
    sections?: Array<{
      sortOrder: number;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<ArticleEntity>;

  async createFullArticle(options: any = {}): Promise<ArticleEntity> {
    return this.articleFactory.createFullArticle(options);
  }

  // ================================
  // News-related methods - delegating to NewsFactory
  // ================================
  async createNews(
    category: CategoryEntity,
    brand?: BrandEntity,
    overrides: Partial<NewsEntity> = {},
  ) {
    return this.newsFactory.createNews(category, brand, overrides);
  }

  async createNewsSection(
    news: NewsEntity,
    overrides: Partial<NewsSectionEntity> = {},
  ) {
    return this.newsFactory.createNewsSection(news, overrides);
  }

  async createNewsSectionImage(
    section: NewsSectionEntity,
    overrides: Partial<NewsSectionImageEntity> = {},
  ) {
    return this.newsFactory.createNewsSectionImage(section, overrides);
  }

  async createFullNews(options?: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    news?: Partial<NewsEntity>;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<NewsEntity>;

  async createFullNews(options: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    news?: Partial<NewsEntity>;
    sections?: Array<{
      sortOrder: number;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<NewsEntity>;

  async createFullNews(options: any = {}): Promise<NewsEntity> {
    return this.newsFactory.createFullNews(options);
  }

  async createArticlesWithDifferentStatuses(
    category?: CategoryEntity,
    brand?: BrandEntity,
  ) {
    return this.articleFactory.createArticlesWithDifferentStatuses(
      category,
      brand,
    );
  }

  async createNewsWithDifferentStatuses(
    category?: CategoryEntity,
    brand?: BrandEntity,
  ) {
    return this.newsFactory.createNewsWithDifferentStatuses(category, brand);
  }

  // ================================
  // Home-related methods - delegating to HomeFactory
  // ================================
  async createHomeBannerImage(overrides: Partial<HomeBannerImageEntity> = {}) {
    return this.homeFactory.createHomeBannerImage(overrides);
  }

  async createHomeSection(overrides: Partial<HomeSectionEntity> = {}) {
    return this.homeFactory.createHomeSection(overrides);
  }

  async createHomeSectionImage(
    section: HomeSectionEntity,
    overrides: Partial<HomeSectionImageEntity> = {},
  ) {
    return this.homeFactory.createHomeSectionImage(section, overrides);
  }

  async createFullHome(options?: {
    bannerCount?: number;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<{
    banners: HomeBannerImageEntity[];
    sections: HomeSectionEntity[];
  }>;

  async createFullHome(options: {
    banners?: Array<{ sortOrder: number; imageUrl: string }>;
    sections?: Array<{
      sortOrder: number;
      url?: string;
      urlName?: string;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<{
    banners: HomeBannerImageEntity[];
    sections: HomeSectionEntity[];
  }>;

  async createFullHome(options: any = {}): Promise<{
    banners: HomeBannerImageEntity[];
    sections: HomeSectionEntity[];
  }> {
    return this.homeFactory.createFullHome(options);
  }

  async createMultilingualHomeSection(
    sectionData: Partial<HomeSectionEntity> = {},
    multilingualData?: {
      title?: { [key in LanguageCode]?: string };
      description?: { [key in LanguageCode]?: string };
    },
  ) {
    return this.homeFactory.createMultilingualHomeSection(
      sectionData,
      multilingualData,
    );
  }

  // ================================
  // Product-related methods - delegating to ProductFactory
  // ================================
  async createProductCategory(overrides: Partial<ProductCategoryEntity> = {}) {
    return this.productFactory.createProductCategory(overrides);
  }

  async createProductBanner(overrides: Partial<ProductBannerEntity> = {}) {
    return this.productFactory.createProductBanner(overrides);
  }

  async createProduct(
    brand: BrandEntity,
    overrides: Partial<ProductEntity> = {},
  ) {
    return this.productFactory.createProduct(brand, overrides);
  }

  async createProductImage(
    product: ProductEntity,
    overrides: Partial<ProductImageEntity> = {},
  ) {
    return this.productFactory.createProductImage(product, overrides);
  }

  async createOption(overrides: Partial<OptionEntity> = {}) {
    return this.productFactory.createOption(overrides);
  }

  async createOptionValue(
    option: OptionEntity,
    overrides: Partial<OptionValueEntity> = {},
  ) {
    return this.productFactory.createOptionValue(option, overrides);
  }

  async createProductVariant(
    product: ProductEntity,
    overrides: Partial<ProductVariantEntity> = {},
  ) {
    return this.productFactory.createProductVariant(product, overrides);
  }

  async createVariantOption(
    variant: ProductVariantEntity,
    optionValue: OptionValueEntity,
  ) {
    return this.productFactory.createVariantOption(variant, optionValue);
  }

  async createProductColor(
    product: ProductEntity,
    optionValue: OptionValueEntity,
    overrides: Partial<ProductColorEntity> = {},
  ) {
    return this.productFactory.createProductColor(
      product,
      optionValue,
      overrides,
    );
  }

  async createProductColorImage(
    productColor: ProductColorEntity,
    overrides: Partial<ProductColorImageEntity> = {},
  ) {
    return this.productFactory.createProductColorImage(productColor, overrides);
  }

  async createMultilingualProductCategory(
    categoryData: Partial<ProductCategoryEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
    },
  ) {
    return this.productFactory.createMultilingualProductCategory(
      categoryData,
      multilingualData,
    );
  }

  async createMultilingualProduct(
    brand: BrandEntity,
    productData: Partial<ProductEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
      description?: { [key in LanguageCode]?: string };
    },
  ) {
    return this.productFactory.createMultilingualProduct(
      brand,
      productData,
      multilingualData,
    );
  }

  async createMultilingualOptionValue(
    option: OptionEntity,
    optionValueData: Partial<OptionValueEntity> = {},
    multilingualData?: {
      value?: { [key in LanguageCode]?: string };
    },
  ) {
    return this.productFactory.createMultilingualOptionValue(
      option,
      optionValueData,
      multilingualData,
    );
  }

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
      optionValueIds: number[];
    }>;
  }) {
    return this.productFactory.createFullProduct(options);
  }

  async createProductsForColorList(brand?: BrandEntity) {
    return this.productFactory.createProductsForColorList(brand);
  }

  // ================================
  // Partner-related methods - delegating to PartnerFactory
  // ================================
  async createPartnerCategory(overrides: Partial<PartnerCategoryEntity> = {}) {
    return this.partnerFactory.createPartnerCategory(overrides);
  }

  async createPartner(overrides: Partial<PartnerEntity> = {}) {
    return this.partnerFactory.createPartner(overrides);
  }

  async createMultilingualPartnerCategory(
    overrides: Partial<PartnerCategoryEntity> = {},
    multilingualData?: {
      name?: Partial<Record<LanguageCode, string>>;
    },
  ) {
    return this.partnerFactory.createMultilingualPartnerCategory(
      overrides,
      multilingualData,
    );
  }

  async createMultilingualPartner(
    overrides: Partial<PartnerEntity> = {},
    multilingualData?: {
      title?: Partial<Record<LanguageCode, string>>;
      description?: Partial<Record<LanguageCode, string>>;
    },
  ) {
    return this.partnerFactory.createMultilingualPartner(
      overrides,
      multilingualData,
    );
  }
}

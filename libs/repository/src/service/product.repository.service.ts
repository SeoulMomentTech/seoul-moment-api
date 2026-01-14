/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetProductDetailOptionValue } from 'apps/api/src/module/product/product.dto';
import { Repository } from 'typeorm';

import { LanguageRepositoryService } from './language.repository.service';
import {
  ProductFilterDto,
  ProductSortDto,
  UpdateProductBannerDto,
  UpdateProductDto,
} from '../dto/product.dto';
import { ProductBannerEntity } from '../entity/product-banner.entity';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { ProductExternalEntity } from '../entity/product-external.entity';
import { ProductFilterEntity } from '../entity/product-filter.entity';
import { ProductItemImageEntity } from '../entity/product-item-image.entity';
import { ProductItemEntity } from '../entity/product-item.entity';
import { ProductVariantEntity } from '../entity/product-variant.entity';
import { ProductEntity } from '../entity/product.entity';
import { VariantOptionEntity } from '../entity/variant-option.entity';
import { BrandStatus } from '../enum/brand.enum';
import { EntityType } from '../enum/entity.enum';
import { LanguageCode } from '../enum/language.enum';
import {
  OptionType,
  ProductItemStatus,
  ProductSortColumn,
  ProductStatus,
  ProductVariantStatus,
} from '../enum/product.enum';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class ProductRepositoryService implements OnModuleInit {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(ProductItemEntity)
    private readonly productItemRepository: Repository<ProductItemEntity>,

    @InjectRepository(ProductBannerEntity)
    private readonly productBannerRepository: Repository<ProductBannerEntity>,

    @InjectRepository(ProductCategoryEntity)
    private readonly productCategoryRepository: Repository<ProductCategoryEntity>,

    @InjectRepository(ProductItemImageEntity)
    private readonly productItemImageRepository: Repository<ProductItemImageEntity>,

    @InjectRepository(VariantOptionEntity)
    private readonly variantOptionRepository: Repository<VariantOptionEntity>,

    @InjectRepository(ProductVariantEntity)
    private readonly productVariantRepository: Repository<ProductVariantEntity>,

    @InjectRepository(ProductFilterEntity)
    private readonly productFilterRepository: Repository<ProductFilterEntity>,

    @InjectRepository(ProductExternalEntity)
    private readonly productExternalRepository: Repository<ProductExternalEntity>,

    private readonly sortOrderHelper: SortOrderHelper,

    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.productFilterRepository.count();
    if (count === 0) {
      await this.productFilterRepository.save([
        {
          sortColumn: 'createDate',
          sort: DatabaseSort.DESC,
          sortOrder: 1,
        },
        {
          sortColumn: 'createDate',
          sort: DatabaseSort.ASC,
          sortOrder: 2,
        },
      ]);

      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_FILTER,
        1,
        'name',
        1,
        '최신순',
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_FILTER,
        1,
        'name',
        2,
        'Latest',
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_FILTER,
        1,
        'name',
        3,
        '最新順序',
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_FILTER,
        2,
        'name',
        1,
        '등록순',
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_FILTER,
        2,
        'name',
        2,
        'Oldest',
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_FILTER,
        2,
        'name',
        3,
        '註冊順序',
      );
    }
  }

  async findProduct(
    pageDto: PagingDto,
    sortDto: ProductSortDto = ProductSortDto.from(
      ProductSortColumn.CREATE,
      DatabaseSort.DESC,
    ),
  ): Promise<[ProductEntity[], number]> {
    const query = this.productRepository.createQueryBuilder('p');

    query.orderBy(`p.${sortDto.sortColumn}`, sortDto.sort);

    return query
      .limit(pageDto.count)
      .offset((pageDto.page - 1) * pageDto.count)
      .getManyAndCount();
  }

  async findBanner(): Promise<ProductBannerEntity[]> {
    return this.productBannerRepository.find({
      order: { sortOrder: 'ASC' },
    });
  }

  async findCategory(): Promise<ProductCategoryEntity[]> {
    return this.productCategoryRepository.find({
      order: { sortOrder: 'ASC' },
    });
  }

  async findCategoryByCategoryId(
    categoryId: number,
  ): Promise<ProductCategoryEntity[]> {
    return this.productCategoryRepository.find({
      where: {
        category: {
          id: categoryId,
        },
      },
      order: { sortOrder: 'ASC' },
    });
  }

  async findProductItem(
    pageDto: PagingDto,
    sortDto: ProductSortDto = ProductSortDto.from(
      ProductSortColumn.CREATE,
      DatabaseSort.DESC,
    ),
    brandId?: number,
    categoryId?: number,
    productCategoryId?: number,
    search?: string,
    withoutId?: number,
    optionIdList?: number[],
  ): Promise<[ProductItemEntity[], number]> {
    // 대용량 최적화: 옵션 필터링을 위한 서브쿼리 생성
    const buildOptionFilterSubquery = () => {
      if (!optionIdList || optionIdList.length === 0) {
        return null;
      }

      // 옵션 필터링: EXISTS 서브쿼리로 최적화 (JOIN 대신)
      return this.productItemRepository.manager
        .createQueryBuilder()
        .select('DISTINCT pv_sub.product_item_id')
        .from('product_variant', 'pv_sub')
        .innerJoin('variant_option', 'vo_sub', 'pv_sub.id = vo_sub.variant_id')
        .where('pv_sub.status = :productVariantStatus', {
          productVariantStatus: ProductVariantStatus.ACTIVE,
        })
        .andWhere('vo_sub.option_value_id IN (:...optionIdList)', {
          optionIdList,
        })
        .groupBy('pv_sub.product_item_id')
        .having('COUNT(DISTINCT vo_sub.option_value_id) = :optionCount', {
          optionCount: optionIdList.length,
        });
    };

    // 대용량 최적화: 검색 조건을 위한 서브쿼리 생성
    const buildSearchSubquery = () => {
      if (!search) {
        return null;
      }

      // 검색: 인덱스를 활용할 수 있도록 서브쿼리 사용
      return this.productItemRepository.manager
        .createQueryBuilder()
        .select('DISTINCT mt.entity_id')
        .from('multilingual_text', 'mt')
        .where("mt.entityType = 'product'")
        .andWhere("mt.field_name = 'name'")
        .andWhere('mt.text_content ILIKE :search', { search: `%${search}%` });
    };

    // 메인 쿼리 빌더 (최적화된 구조)
    const buildMainQuery = (selectFields: string = 'pc.id') => {
      const query = this.productItemRepository
        .createQueryBuilder('pc')
        .innerJoin('pc.product', 'p')
        .innerJoin('p.brand', 'b')
        .leftJoin('p.category', 'c');

      // 인덱스 활용을 위한 조건 순서 최적화 (선택도가 높은 순서)
      // status 조건을 먼저 적용 (인덱스 활용)
      query
        .where('pc.status = :productItemStatus', {
          productItemStatus: ProductItemStatus.NORMAL,
        })
        .andWhere('p.status = :productStatus', {
          productStatus: ProductStatus.NORMAL,
        })
        .andWhere('b.status = :brandStatus', {
          brandStatus: BrandStatus.NORMAL,
        });

      // 필터 조건들
      if (brandId) {
        query.andWhere('p.brand_id = :brandId', { brandId });
      }

      if (productCategoryId) {
        query.andWhere('p.product_category_id = :productCategoryId', {
          productCategoryId,
        });
      }

      if (categoryId) {
        query.andWhere('c.id = :categoryId', { categoryId });
      }

      if (withoutId) {
        query.andWhere('p.id != :withoutId', { withoutId });
      }

      // 옵션 필터링: EXISTS 서브쿼리 사용 (JOIN 대신)
      const optionSubquery = buildOptionFilterSubquery();
      if (optionSubquery) {
        query.andWhere(
          `pc.id IN (${optionSubquery.getQuery()})`,
          optionSubquery.getParameters(),
        );
      }

      // 검색 조건: 서브쿼리 사용
      const searchSubquery = buildSearchSubquery();
      if (searchSubquery) {
        query.andWhere(
          `p.id IN (${searchSubquery.getQuery()})`,
          searchSubquery.getParameters(),
        );
      }

      if (selectFields !== 'pc.id') {
        query.select(selectFields);
      }

      return query;
    };

    // Count 쿼리 최적화: 서브쿼리 활용
    const getOptimizedCount = async (): Promise<number> => {
      const countQuery = buildMainQuery('COUNT(DISTINCT pc.id) as count');
      const result = await countQuery.getRawOne();
      return parseInt(result?.count || '0', 10);
    };

    const totalCount = await getOptimizedCount();

    if (totalCount === 0) {
      return [[], 0];
    }

    // ID 조회 쿼리 (대용량 최적화: 필요한 컬럼만 SELECT)
    const idQuery = buildMainQuery('pc.id');

    // 정렬 최적화: 계산된 가격 vs 단일 컬럼
    if (sortDto.sortColumn === ProductSortColumn.PRICE) {
      idQuery.orderBy(
        'CASE WHEN pc.discountPrice > 0 THEN pc.discountPrice ELSE pc.price END',
        sortDto.sort,
      );
    } else {
      idQuery.orderBy(`pc.${sortDto.sortColumn}`, sortDto.sort);
    }

    // 페이징 적용
    idQuery.limit(pageDto.count).offset((pageDto.page - 1) * pageDto.count);

    const productItemIds = await idQuery.getRawMany();

    if (productItemIds.length === 0) {
      return [[], totalCount];
    }

    const ids = productItemIds.map((item) => item.pc_id);

    // 메인 데이터 조회: IN 절 최적화 (필요한 관계만 로드)
    const results = await this.productItemRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('p.category', 'c')
      .leftJoinAndSelect('p.productCategory', 'pcg')
      .leftJoinAndSelect('pc.variants', 'pv')
      .leftJoinAndSelect('pv.variantOptions', 'vo')
      .leftJoinAndSelect('vo.optionValue', 'ov')
      .leftJoinAndSelect('ov.option', 'o')
      .where('pc.id = ANY(:ids)', { ids }) // IN 대신 ANY 사용 (PostgreSQL 최적화)
      .andWhere('(pv.status = :productVariantStatus OR pv.status IS NULL)', {
        productVariantStatus: ProductVariantStatus.ACTIVE,
      })
      .orderBy(
        // 동일한 정렬 조건 적용
        sortDto.sortColumn === ProductSortColumn.PRICE
          ? 'CASE WHEN pc.discountPrice > 0 THEN pc.discountPrice ELSE pc.price END'
          : `pc.${sortDto.sortColumn}`,
        sortDto.sort,
      )
      .getMany();

    return [results, totalCount];
  }

  async getProductByProductId(productId: number): Promise<ProductEntity> {
    const result = await this.productRepository.findOne({
      where: {
        id: productId,
      },
    });

    if (!result)
      throw new ServiceError(
        `No exist product ID: ${productId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return result;
  }

  async getProductItemByProductItemId(
    productItemId: number,
  ): Promise<ProductItemEntity> {
    const result = await this.productItemRepository.findOne({
      where: {
        id: productItemId,
      },
      relations: [
        'product',
        'product.brand',
        'images',
        'variants',
        'variants.variantOptions',
        'variants.variantOptions.optionValue',
        'variants.variantOptions.optionValue.option',
      ],
    });

    if (!result)
      throw new ServiceError(
        `No exist product item ID: ${productItemId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return result;
  }

  async getProductItemDetail(id: number): Promise<ProductItemEntity> {
    const result = await this.productItemRepository.findOne({
      where: {
        id,
        status: ProductItemStatus.NORMAL,
      },
      relations: ['product', 'product.brand', 'images'],
    });

    if (!result)
      throw new ServiceError(
        'no exist product',
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return result;
  }

  async getProductOption(
    type: OptionType,
    productId: number,
    languageId: number,
  ): Promise<GetProductDetailOptionValue[]> {
    const subQuery = this.productRepository.manager
      .createQueryBuilder()
      .select('pv.id')
      .from('product_variant', 'pv')
      .where('pv.product_item_id = :productId', { productId });

    const result = await this.productRepository.manager
      .createQueryBuilder()
      .select('ov.id', 'id')
      .addSelect('mt.text_content', 'value')
      .from('variant_option', 'vo')
      .leftJoin('option_value', 'ov', 'vo.option_value_id = ov.id')
      .leftJoin('option', 'o', 'o.id = ov.option_id')
      .leftJoin(
        'multilingual_text',
        'mt',
        "mt.entity_id = ov.id AND mt.field_name = 'value' AND mt.language_id = :languageId AND mt.entityType = 'option_value'",
        { languageId },
      )
      .where(`vo.variant_id IN (${subQuery.getQuery()})`)
      .andWhere('o.type = :type', { type })
      .groupBy('ov.id')
      .addGroupBy('mt.text_content')
      .orderBy('ov.sort_order')
      .setParameters(subQuery.getParameters())
      .getRawMany();

    return result;
  }

  async getProductOptionTypes(productId: number): Promise<OptionType[]> {
    const subQuery = this.productRepository.manager
      .createQueryBuilder()
      .select('pv.id')
      .from('product_variant', 'pv')
      .where('pv.product_item_id = :productId', { productId });

    const result = await this.productRepository.manager
      .createQueryBuilder()
      .select('o.type', 'type')
      .from('variant_option', 'vo')
      .leftJoin('option_value', 'ov', 'vo.option_value_id = ov.id')
      .leftJoin('option', 'o', 'o.id = ov.option_id')
      .where(`vo.variant_id IN (${subQuery.getQuery()})`)
      .andWhere('o.is_active = true')
      .groupBy('o.type')
      .setParameters(subQuery.getParameters())
      .getRawMany();

    return result.map((item) => item.type);
  }

  async insert(entity: ProductEntity): Promise<ProductEntity> {
    return this.productRepository.save(entity);
  }

  async bulkInsertBanner(
    entity: ProductBannerEntity[],
  ): Promise<ProductBannerEntity[]> {
    return this.productBannerRepository.save(entity);
  }

  async insertBanner(entity: ProductBannerEntity) {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.productBannerRepository,
    );

    return this.productBannerRepository.save(entity);
  }

  async updateBanner(entity: UpdateProductBannerDto) {
    return this.productBannerRepository.save(entity);
  }

  async deleteBanner(id: number) {
    return this.productBannerRepository.delete(id);
  }

  async bulkUpdateBannerSortOrder(entity: ProductBannerEntity[]) {
    return this.productBannerRepository.save(entity);
  }

  async findVariantOptionsByProduct(
    categoryId: number,
    brandId?: number,
    productCategoryId?: number,
  ): Promise<VariantOptionEntity[]> {
    const query = this.variantOptionRepository
      .createQueryBuilder('vo')
      .leftJoinAndSelect('vo.variant', 'pv')
      .leftJoinAndSelect('vo.optionValue', 'ov')
      .leftJoinAndSelect('ov.option', 'o')
      .leftJoinAndSelect('pv.productItem', 'pi')
      .leftJoinAndSelect('pi.product', 'p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.productCategory', 'productCategory')
      .where('category.id = :categoryId', { categoryId });

    if (brandId) {
      query.andWhere('p.brand_id = :brandId', { brandId });
    }

    if (productCategoryId) {
      query.andWhere('p.product_category_id = :productCategoryId', {
        productCategoryId,
      });
    }

    return query.getMany();
  }

  async findDistinctFilterOptionsByProduct(
    categoryId: number,
    languageCode: LanguageCode,
    brandId?: number,
    productCategoryId?: number,
  ): Promise<ProductFilterDto[]> {
    const query = this.variantOptionRepository
      .createQueryBuilder('vo')
      .select([
        'ov.id AS "optionValueId"',
        'mt_option.text_content AS "optionType"',
        'ov.color_code AS "colorCode"',
        'mt_option_value.text_content AS "textContent"',
        'o.ui_type AS "optionUiType"',
      ])
      .leftJoin('vo.optionValue', 'ov')
      .leftJoin('ov.option', 'o')
      .leftJoin('vo.variant', 'pv')
      .leftJoin('pv.productItem', 'pi')
      .leftJoin('pi.product', 'p')
      .leftJoin('p.category', 'category')
      .leftJoin(
        'multilingual_text',
        'mt_option_value',
        'mt_option_value.entity_id = ov.id AND mt_option_value.entity_type = :entityTypeOV AND mt_option_value.field_name = :fieldNameOV AND mt_option_value.language_id IN (SELECT id FROM language WHERE code = :languageCodeOV AND is_active = true)',
        {
          entityTypeOV: EntityType.OPTION_VALUE,
          fieldNameOV: 'value',
          languageCodeOV: languageCode,
        },
      )
      .leftJoin(
        'multilingual_text',
        'mt_option',
        'mt_option.entity_id = o.id AND mt_option.entity_type = :entityTypeO AND mt_option.field_name = :fieldNameO AND mt_option.language_id IN (SELECT id FROM language WHERE code = :languageCodeO AND is_active = true)',
        {
          entityTypeO: EntityType.OPTION,
          fieldNameO: 'name',
          languageCodeO: languageCode,
        },
      )
      .where('category.id = :categoryId', { categoryId });

    if (brandId) {
      query.andWhere('p.brand_id = :brandId', { brandId });
    }

    if (productCategoryId) {
      query.andWhere('p.product_category_id = :productCategoryId', {
        productCategoryId,
      });
    }

    const results = await query
      .groupBy(
        'ov.id, o.type, ov.color_code, mt_option_value.text_content, mt_option.text_content, o.ui_type',
      )
      .getRawMany();

    const allMap = new Map<
      string,
      {
        optionValueId: number;
        name: string;
        code: string | null;
        optionType: OptionType;
        optionUiType: string;
      }
    >();

    for (const row of results) {
      const optionValueId = row.optionValueId;
      const name = row.textContent || '';
      const optionType = row.optionType;

      allMap.set(name, {
        optionValueId,
        name,
        code: row.colorCode || null,
        optionType,
        optionUiType: row.optionUiType,
      });
    }
    return Array.from(allMap.values());
  }

  async insertProductItem(
    entity: ProductItemEntity,
  ): Promise<ProductItemEntity> {
    return this.productItemRepository.save(entity);
  }

  async insertProductItemImage(
    entity: ProductItemImageEntity,
  ): Promise<ProductItemImageEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.productItemImageRepository,
    );

    return this.productItemImageRepository.save(entity);
  }

  async insertProductVariant(
    entity: ProductVariantEntity,
  ): Promise<ProductVariantEntity> {
    return this.productVariantRepository.save(entity);
  }

  async getProductVariantBySku(sku: string): Promise<ProductVariantEntity> {
    const result = await this.productVariantRepository.findOneBy({
      sku,
      status: ProductVariantStatus.ACTIVE,
    });

    if (!result)
      throw new ServiceError(
        `No exist product variant SKU: ${sku}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    return result;
  }

  async existProductVariantBySku(sku: string): Promise<boolean> {
    const result = await this.productVariantRepository.findOneBy({
      sku,
      status: ProductVariantStatus.ACTIVE,
    });
    return !!result;
  }

  async findBannerByFilter(
    page: number,
    count: number,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[ProductBannerEntity[], number]> {
    const [productBannerEntities, total] =
      await this.productBannerRepository.findAndCount({
        order: {
          sortOrder: sort,
        },
        skip: (page - 1) * count,
        take: count,
      });
    return [productBannerEntities, total];
  }

  async delete(id: number) {
    return this.productRepository.delete(id);
  }

  async update(entity: UpdateProductDto) {
    return this.productRepository.save(entity);
  }

  async findCategoryWithFilter(
    pageDto: PagingDto,
    sortDto: ProductSortDto = ProductSortDto.from(
      ProductSortColumn.CREATE,
      DatabaseSort.DESC,
    ),
  ): Promise<[ProductCategoryEntity[], number]> {
    const query = this.productCategoryRepository.createQueryBuilder('pc');

    query.orderBy(`pc.${sortDto.sortColumn}`, sortDto.sort);

    return query
      .limit(pageDto.count)
      .offset((pageDto.page - 1) * pageDto.count)
      .getManyAndCount();
  }

  async getBannerById(id: number): Promise<ProductBannerEntity> {
    const result = await this.productBannerRepository.findOneBy({
      id,
    });

    if (!result)
      throw new ServiceError(
        `No exist product banner ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    return result;
  }

  async getProductItemCount(status?: ProductItemStatus): Promise<number> {
    const query = this.productItemRepository.createQueryBuilder('pi');

    if (status) {
      query.where('pi.status = :status', { status });
    }

    return query.getCount();
  }

  async getProductExternalByProductItemId(
    productItemId: number,
  ): Promise<ProductExternalEntity[]> {
    return this.productExternalRepository.find({
      where: { productItemId },
      relations: ['externalLink'],
    });
  }
}

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
import { ProductFilterDto, ProductSortDto } from '../dto/product.dto';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { ProductFilterEntity } from '../entity/product-filter.entity';
import { ProductItemImageEntity } from '../entity/product-item-image.entity';
import { ProductItemEntity } from '../entity/product-item.entity';
import { ProductVariantEntity } from '../entity/product-variant.entity';
import { ProductEntity } from '../entity/product.entity';
import { ProductBannerEntity } from '../entity/product_banner.entity';
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
    // 대용량 최적화: 인덱스 힌트를 위한 조건 순서 최적화
    const buildBaseQuery = () => {
      const query = this.productItemRepository
        .createQueryBuilder('pc')
        .innerJoin('pc.product', 'p') // LEFT → INNER: 성능 개선
        .innerJoin('p.brand', 'b')
        .leftJoin('p.category', 'c')
        .leftJoin('pc.variants', 'pv')
        .leftJoin('pv.variantOptions', 'vo');

      // 인덱스 활용을 위한 조건 순서 최적화 (선택도가 높은 순서)
      if (brandId) {
        query.where('b.id = :brandId', { brandId });
      }

      if (productCategoryId) {
        query.andWhere('p.product_category_id = :productCategoryId', {
          productCategoryId,
        });
      }

      if (categoryId) {
        query.andWhere('c.id = :categoryId', { categoryId });
      }

      if (optionIdList) {
        query.andWhere('vo.option_value_id IN (:...optionIdList)', {
          optionIdList,
        });
      }

      if (withoutId) {
        query.andWhere('p.id != :withoutId', { withoutId });
      }

      // status 조건들 (인덱스된 컬럼들)
      query
        .andWhere('pc.status = :productItemStatus', {
          productItemStatus: ProductItemStatus.NORMAL,
        })
        .andWhere('p.status = :productStatus', {
          productStatus: ProductStatus.NORMAL,
        })
        .andWhere('b.status = :brandStatus', {
          brandStatus: BrandStatus.NORMAL,
        })
        .andWhere('pv.status = :productVariantStatus', {
          productVariantStatus: ProductVariantStatus.ACTIVE,
        });

      return query;
    };

    // 검색 조건 추가 (가장 비용이 큰 조건을 마지막에)
    const applySearchCondition = (query: any) => {
      if (search) {
        query
          .innerJoin(
            // 검색시에만 INNER JOIN으로 성능 최적화
            'multilingual_text',
            'mt',
            `mt.entityType = 'product' AND mt.entity_id = p.id AND mt.field_name = 'name'`,
          )
          .andWhere('mt.text_content ILIKE :search', { search: `%${search}%` });
      }
    };

    // Count 쿼리 최적화: 불필요한 JOIN 제거
    const getOptimizedCount = async (): Promise<number> => {
      // 항상 buildBaseQuery를 사용한다. (이 조건들이 똑같이 들어가야 함)
      const countQuery = buildBaseQuery().select(
        'COUNT(DISTINCT pc.id)',
        'count',
      );

      applySearchCondition(countQuery);

      const result = await countQuery.getRawOne();
      return parseInt(result.count, 10);
    };

    const totalCount = await getOptimizedCount();

    if (totalCount === 0) {
      return [[], 0];
    }

    // ID 조회 쿼리 (대용량 최적화: 필요한 컬럼만 SELECT)
    const idQuery = buildBaseQuery().select('pc.id');

    applySearchCondition(idQuery);

    // 정렬 최적화: 계산된 가격 vs 단일 컬럼
    if (sortDto.sortColumn === ProductSortColumn.PRICE) {
      // 0보다 큰 할인가가 있으면 할인가, 없으면 원가
      idQuery.orderBy(
        'CASE WHEN pc.discountPrice > 0 THEN pc.discountPrice ELSE pc.price END',
        sortDto.sort,
      );
    } else {
      idQuery.orderBy(`pc.${sortDto.sortColumn}`, sortDto.sort);
    }

    if (search) {
      idQuery.groupBy('pc.id'); // 검색시에만 GROUP BY 적용
    }

    const productItemIds = await idQuery.getRawMany();

    if (productItemIds.length === 0) {
      return [[], totalCount];
    }

    const ids = productItemIds.map((item) => item.pc_id);

    // 메인 데이터 조회: IN 절 최적화
    const results = await this.productItemRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('p.category', 'c')
      .where('pc.id = ANY(:ids)', { ids }) // IN 대신 ANY 사용 (PostgreSQL 최적화)
      .orderBy(
        // 동일한 정렬 조건 적용
        sortDto.sortColumn === ProductSortColumn.PRICE
          ? 'CASE WHEN pc.discountPrice > 0 THEN pc.discountPrice ELSE pc.price END'
          : `pc.${sortDto.sortColumn}`,
        sortDto.sort,
      )
      .limit(pageDto.count)
      .offset((pageDto.page - 1) * pageDto.count)
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
    const result = await this.productItemRepository.findOneBy({
      id: productItemId,
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
        'ov.id, o.type, ov.color_code, mt_option_value.text_content, mt_option.text_content',
      )
      .getRawMany();

    const allMap = new Map<
      string,
      {
        optionValueId: number;
        name: string;
        code: string | null;
        optionType: OptionType;
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
}

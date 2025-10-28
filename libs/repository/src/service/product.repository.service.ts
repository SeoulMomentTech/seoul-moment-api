/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetProductDetailOptionValue } from 'apps/api/src/module/product/product.dto';
import { Repository } from 'typeorm';

import { ProductSortDto } from '../dto/product.dto';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { ProductItemEntity } from '../entity/product-item.entity';
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
} from '../enum/product.enum';

@Injectable()
export class ProductRepositoryService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(ProductItemEntity)
    private readonly productItemRepository: Repository<ProductItemEntity>,

    @InjectRepository(ProductBannerEntity)
    private readonly productBannerRepository: Repository<ProductBannerEntity>,

    @InjectRepository(ProductCategoryEntity)
    private readonly productCategoryRepository: Repository<ProductCategoryEntity>,

    @InjectRepository(VariantOptionEntity)
    private readonly variantOptionRepository: Repository<VariantOptionEntity>,
  ) {}

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
  ): Promise<[ProductItemEntity[], number]> {
    // 대용량 최적화: 인덱스 힌트를 위한 조건 순서 최적화
    const buildBaseQuery = () => {
      const query = this.productItemRepository
        .createQueryBuilder('pc')
        .innerJoin('pc.product', 'p') // LEFT → INNER: 성능 개선
        .innerJoin('p.brand', 'b')
        .leftJoin('p.category', 'c'); // category는 nullable할 수 있으므로 LEFT 유지

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
      if (!search && !categoryId && !productCategoryId && !brandId) {
        // 간단한 조건만 있을 때는 단일 테이블 COUNT
        return this.productItemRepository
          .createQueryBuilder('pc')
          .where('pc.status = :status', { status: ProductItemStatus.NORMAL })
          .getCount();
      }

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
    if (sortDto.sortColum === ProductSortColumn.PRICE) {
      // 0보다 큰 할인가가 있으면 할인가, 없으면 원가
      idQuery.orderBy(
        'CASE WHEN pc.discountPrice > 0 THEN pc.discountPrice ELSE pc.price END',
        sortDto.sort,
      );
    } else {
      idQuery.orderBy(`pc.${sortDto.sortColum}`, sortDto.sort);
    }

    // 페이징 적용
    idQuery.limit(pageDto.count).offset((pageDto.page - 1) * pageDto.count);

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
        sortDto.sortColum === ProductSortColumn.PRICE
          ? 'CASE WHEN pc.discountPrice > 0 THEN pc.discountPrice ELSE pc.price END'
          : `pc.${sortDto.sortColum}`,
        sortDto.sort,
      )
      .getMany();

    return [results, totalCount];
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
      .where('pv.product_id = :productId', { productId });

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
      .where('pv.product_id = :productId', { productId });

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
  ): Promise<{
    genders: Array<{ variantId: number; name: string }>;
    sizes: Array<{ variantId: number; name: string }>;
    colors: Array<{ variantId: number; name: string; code: string }>;
  }> {
    // 직접 JOIN으로 간단하게 처리
    const query = this.variantOptionRepository
      .createQueryBuilder('vo')
      .select([
        'vo.variant_id AS variantId',
        'ov.id AS optionValueId',
        'o.type AS optionType',
        'ov.color_code AS colorCode',
        'mt.text_content AS textContent',
      ])
      .leftJoin('vo.optionValue', 'ov')
      .leftJoin('ov.option', 'o')
      .leftJoin('vo.variant', 'pv')
      .leftJoin('pv.productItem', 'pi')
      .leftJoin('pi.product', 'p')
      .leftJoin('p.category', 'category')
      .leftJoin(
        'multilingual_text',
        'mt',
        'mt.entity_id = ov.id AND mt.entity_type = :entityType AND mt.field_name = :fieldName AND mt.language_id IN (SELECT id FROM language WHERE code = :languageCode AND is_active = true)',
        {
          entityType: EntityType.OPTION_VALUE,
          fieldName: 'value',
          languageCode,
        },
      )
      .where('category.id = :categoryId', { categoryId })
      .andWhere('ov.is_active = true')
      .andWhere('o.is_active = true');

    if (brandId) {
      query.andWhere('p.brand_id = :brandId', { brandId });
    }

    if (productCategoryId) {
      query.andWhere('p.product_category_id = :productCategoryId', {
        productCategoryId,
      });
    }

    const results = await query
      .groupBy('ov.id')
      .addGroupBy('vo.variant_id')
      .addGroupBy('o.type')
      .addGroupBy('ov.color_code')
      .addGroupBy('mt.text_content')
      .setParameter('categoryId', categoryId)
      .setParameter('languageCode', languageCode)
      .setParameter('brandId', brandId)
      .setParameter('productCategoryId', productCategoryId)
      .getRawMany();

    // 결과를 타입별로 분류 (이름 기준 중복 제거)
    const genderMap = new Map<string, { variantId: number; name: string }>();
    const sizeMap = new Map<string, { variantId: number; name: string }>();
    const colorMap = new Map<
      string,
      { variantId: number; name: string; code: string }
    >();

    for (const row of results) {
      const name = row.textContent || '';
      const variantId = row.variantId;
      const optionType = row.optionType;

      if (optionType === OptionType.GENDER && name) {
        if (!genderMap.has(name)) {
          genderMap.set(name, { variantId, name });
        }
      } else if (optionType === OptionType.SIZE && name) {
        if (!sizeMap.has(name)) {
          sizeMap.set(name, { variantId, name });
        }
      } else if (optionType === OptionType.COLOR && name) {
        const code = row.colorCode || '';
        if (!colorMap.has(name)) {
          colorMap.set(name, { variantId, name, code });
        }
      }
    }

    return {
      genders: Array.from(genderMap.values()),
      sizes: Array.from(sizeMap.values()),
      colors: Array.from(colorMap.values()),
    };
  }
}

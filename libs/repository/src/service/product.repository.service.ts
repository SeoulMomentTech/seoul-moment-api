/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { DatabaseSort } from '@app/common/enum/global.enum';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductSortDto } from '../dto/product.dto';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { ProductColorEntity } from '../entity/product-color.entity';
import { ProductEntity } from '../entity/product.entity';
import { ProductBannerEntity } from '../entity/product_banner.entity';
import { BrandStatus } from '../enum/brand.enum';
import {
  ProductColorStatus,
  ProductSortColumn,
  ProductStatus,
} from '../enum/product.enum';

@Injectable()
export class ProductRepositoryService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(ProductColorEntity)
    private readonly productColorRepository: Repository<ProductColorEntity>,

    @InjectRepository(ProductBannerEntity)
    private readonly productBannerRepository: Repository<ProductBannerEntity>,

    @InjectRepository(ProductCategoryEntity)
    private readonly productCategoryRepository: Repository<ProductCategoryEntity>,
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

  async findProductColor(
    pageDto: PagingDto,
    sortDto: ProductSortDto = ProductSortDto.from(
      ProductSortColumn.CREATE,
      DatabaseSort.DESC,
    ),
    brandId?: number,
    categoryId?: number,
    productCategoryId?: number,
    search?: string,
  ): Promise<[ProductColorEntity[], number]> {
    // 공통 조건을 적용하는 함수
    const applyConditions = (queryBuilder: any) => {
      queryBuilder
        .leftJoin('pc.product', 'p')
        .leftJoin('p.brand', 'b')
        .leftJoin('p.category', 'c')
        .where('b.status = :brandStatus', { brandStatus: BrandStatus.NORMAL })
        .andWhere('p.status = :productStatus', {
          productStatus: ProductStatus.NORMAL,
        })
        .andWhere('pc.status = :productColorStatus', {
          productColorStatus: ProductColorStatus.NORMAL,
        });

      if (brandId) {
        queryBuilder.andWhere('b.id = :brandId', { brandId });
      }

      if (categoryId) {
        queryBuilder.andWhere('c.id = :categoryId', { categoryId });
      }

      if (productCategoryId) {
        queryBuilder.andWhere('p.product_category_id = :productCategoryId', {
          productCategoryId,
        });
      }

      if (search) {
        queryBuilder
          .leftJoin(
            'multilingual_text',
            'mt',
            "mt.entity_type = 'product' AND mt.entity_id = p.id AND mt.field_name = 'name'",
          )
          .andWhere('mt.text_content ILIKE :search', { search: `%${search}%` })
          .groupBy('pc.id');
      }
    };

    // 1. 전체 개수 조회 (조건만 적용, 페이징/정렬 없음)
    const countQuery = this.productColorRepository.createQueryBuilder('pc');
    applyConditions(countQuery);
    const totalCount = await countQuery.getCount();

    if (totalCount === 0) {
      return [[], 0];
    }

    // 2. 페이징된 ID 조회 (정렬 적용)
    const idQuery = this.productColorRepository
      .createQueryBuilder('pc')
      .select('pc.id');

    applyConditions(idQuery);

    // 정렬 처리
    if (sortDto.sortColum === ProductSortColumn.PRICE) {
      idQuery.orderBy('COALESCE(pc.discount_price, pc.price)', sortDto.sort);
    } else {
      idQuery.orderBy(`pc.${sortDto.sortColum}`, sortDto.sort);
    }

    idQuery.limit(pageDto.count).offset((pageDto.page - 1) * pageDto.count);

    const productColorIds = await idQuery.getRawMany();
    const ids = productColorIds.map((item) => item.pc_id);

    // 3. 실제 데이터 조회 (관계 포함)
    const results = await this.productColorRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('p.category', 'c')
      .where('pc.id IN (:...ids)', { ids })
      .orderBy(
        sortDto.sortColum === ProductSortColumn.PRICE
          ? 'COALESCE(pc.discount_price, pc.price)'
          : `pc.${sortDto.sortColum}`,
        sortDto.sort,
      )
      .getMany();

    return [results, totalCount];
  }
}

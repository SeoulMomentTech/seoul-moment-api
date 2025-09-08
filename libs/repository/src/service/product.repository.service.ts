import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BrandEntity } from '../entity/brand.entity';
import { CategoryEntity } from '../entity/category.entity';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { ProductColorEntity } from '../entity/product-color.entity';
import { ProductEntity } from '../entity/product.entity';
import { ProductBannerEntity } from '../entity/product_banner.entity';
import { BrandStatus } from '../enum/brand.enum';
import { ProductColorStatus, ProductStatus } from '../enum/product.enum';

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

  async findProduct(
    brandId?: number,
    categoryId?: number,
    productCategoryId?: number,
  ): Promise<ProductColorEntity[]> {
    const query = this.productColorRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect(ProductEntity, 'p', 'pc.product_id = p.id')
      .leftJoinAndSelect(BrandEntity, 'b', 'p.brand_id = b.id')
      .leftJoinAndSelect(CategoryEntity, 'c', 'p.category_id = c.id')
      .where('b.status = :status', { status: BrandStatus.NORMAL })
      .andWhere('p.status = :status', { status: ProductStatus.NORMAL })
      .andWhere('pc.status = :status', { status: ProductColorStatus.NORMAL });

    if (brandId) {
      query.andWhere('b.id = :brandId', { brandId });
    }

    if (categoryId) {
      query.andWhere('c.id = :categoryId', { categoryId });
    }

    if (productCategoryId) {
      query.andWhere('pc.id = :productCategoryId', { productCategoryId });
    }

    return await query.getMany();
  }
}

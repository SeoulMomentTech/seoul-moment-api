import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductFilterEntity } from '../entity/product-filter.entity';

@Injectable()
export class ProductFilterRepositoryService {
  constructor(
    @InjectRepository(ProductFilterEntity)
    private readonly productFilterRepository: Repository<ProductFilterEntity>,
  ) {}

  async findAllProductFilters(): Promise<ProductFilterEntity[]> {
    return this.productFilterRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findProductFilterById(id: number): Promise<ProductFilterEntity | null> {
    return this.productFilterRepository.findOneBy({ id });
  }

  async createProductFilter(
    productFilter: ProductFilterEntity,
  ): Promise<ProductFilterEntity> {
    return this.productFilterRepository.save(productFilter);
  }

  async updateProductFilter(
    productFilter: ProductFilterEntity,
  ): Promise<ProductFilterEntity> {
    return this.productFilterRepository.save(productFilter);
  }

  async deleteProductFilter(id: number): Promise<void> {
    await this.productFilterRepository.delete(id);
  }
}

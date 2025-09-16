import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CategoryEntity } from '../entity/category.entity';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class CategoryRepositoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(ProductCategoryEntity)
    private readonly productCategoryRepository: Repository<ProductCategoryEntity>,

    private readonly sortOrderHelper: SortOrderHelper,
  ) {}

  async findCategory(): Promise<CategoryEntity[]> {
    return this.categoryRepository.find({
      order: {
        sortOrder: 'ASC',
      },
    });
  }

  async findProductCategory(): Promise<ProductCategoryEntity[]> {
    return this.productCategoryRepository.find({
      order: {
        sortOrder: 'ASC',
      },
    });
  }

  async insert(entity: CategoryEntity): Promise<CategoryEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.categoryRepository,
    );

    return this.categoryRepository.save(entity);
  }

  async bulkInsert(entity: CategoryEntity[]): Promise<CategoryEntity[]> {
    return this.categoryRepository.save(entity);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CategoryEntity } from '../entity/category.entity';
import { ProductCategoryEntity } from '../entity/product-category.entity';

@Injectable()
export class CategoryRepositoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(ProductCategoryEntity)
    private readonly productCategoryRepository: Repository<ProductCategoryEntity>,
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
    if (!entity.sortOrder) {
      const maxSortOrder = await this.categoryRepository
        .createQueryBuilder('category')
        .select('MAX(category.sortOrder)', 'max')
        .getRawOne();

      entity.sortOrder = (maxSortOrder?.max || 0) + 1;
    }

    return this.categoryRepository.save(entity);
  }

  async bulkInsert(entity: CategoryEntity[]): Promise<CategoryEntity[]> {
    return this.categoryRepository.save(entity);
  }
}

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
}

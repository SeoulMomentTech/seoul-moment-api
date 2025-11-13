import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
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

  async getCategoryById(id: number): Promise<CategoryEntity> {
    const result = await this.categoryRepository.findOneBy({ id });

    if (!result) {
      throw new ServiceError(
        `Category not found id: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

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

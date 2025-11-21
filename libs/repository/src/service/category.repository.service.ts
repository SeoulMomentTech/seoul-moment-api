import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';

import { UpdateCategoryDto } from '../dto/category.dto';
import { CategoryEntity } from '../entity/category.entity';
import { MultilingualTextEntity } from '../entity/multilingual-text.entity';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { CategorySearchEnum } from '../enum/category.repository.enum';
import { EntityType } from '../enum/entity.enum';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class CategoryRepositoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(ProductCategoryEntity)
    private readonly productCategoryRepository: Repository<ProductCategoryEntity>,

    @InjectRepository(MultilingualTextEntity)
    private readonly multilingualTextRepository: Repository<MultilingualTextEntity>,

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

  async findCategoryByFilter(
    page: number,
    count: number,
    searchName?: string,
    searchColumn?: CategorySearchEnum,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[CategoryEntity[], number]> {
    let categoryIds: number[] = [];

    if (searchName) {
      const multilingualTexts = await this.multilingualTextRepository.find({
        where: {
          entityType: EntityType.CATEGORY,
          fieldName: searchColumn,
          textContent: Like(`%${searchName}%`),
        },
      });

      categoryIds = multilingualTexts.map((text) => text.entityId);
    }

    const [categoryEntities, total] =
      await this.categoryRepository.findAndCount({
        where: {
          id: searchName ? In(categoryIds) : undefined,
        },
        order: {
          sortOrder: sort,
        },
        skip: (page - 1) * count,
        take: count,
      });

    return [categoryEntities, total];
  }

  async findProductCategory(): Promise<ProductCategoryEntity[]> {
    return this.productCategoryRepository.find({
      order: {
        sortOrder: 'ASC',
      },
    });
  }

  async getProductCategoryById(id: number): Promise<ProductCategoryEntity> {
    const result = await this.productCategoryRepository.findOneBy({ id });

    if (!result) {
      throw new ServiceError(
        `Product category not found id: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }
    return result;
  }

  async findProductCategoryById(id: number): Promise<ProductCategoryEntity> {
    return this.productCategoryRepository.findOneBy({ id });
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

  async insertProductCategory(
    entity: ProductCategoryEntity,
  ): Promise<ProductCategoryEntity> {
    return this.productCategoryRepository.save(entity);
  }

  @Transactional()
  async deleteCategoryById(id: number): Promise<void> {
    await this.categoryRepository.delete({ id });

    await this.multilingualTextRepository.delete({
      entityType: EntityType.CATEGORY,
      entityId: id,
    });
  }

  async updateCategory(entity: UpdateCategoryDto): Promise<CategoryEntity> {
    return this.categoryRepository.save(entity);
  }
}

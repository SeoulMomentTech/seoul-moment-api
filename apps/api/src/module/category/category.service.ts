import { CategoryEntity } from '@app/repository/entity/category.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import { GetCategoryResponse, PostCategoryRequest } from './category.dto';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getCategory(language: LanguageCode): Promise<GetCategoryResponse[]> {
    const categoryEntityList =
      await this.categoryRepositoryService.findCategory();

    const [categoryText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.CATEGORY,
        categoryEntityList.map((v) => v.id),
        language,
      ),
    ]);

    return categoryEntityList.map((v) =>
      GetCategoryResponse.from(v, categoryText),
    );
  }

  @Transactional()
  async postCategory(dto: PostCategoryRequest) {
    const categoryEntity = await this.categoryRepositoryService.insert(
      plainToInstance(CategoryEntity, {}),
    );

    for (const v of dto.list) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.CATEGORY,
        categoryEntity.id,
        'name',
        v.languageId,
        v.name,
      );
    }
  }
}

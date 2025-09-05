import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import { GetCategoryResponse } from './category.dto';

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
}

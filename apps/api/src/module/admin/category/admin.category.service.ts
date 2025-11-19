import { EntityType } from '@app/repository/enum/entity.enum';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import {
  AdminCategoryListRequest,
  GetAdminCategoryListResponse,
  GetAdminCategoryNameDto,
} from './admin.category.dto';

@Injectable()
export class AdminCategoryService {
  constructor(
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getAdminCategoryList(
    request: AdminCategoryListRequest,
  ): Promise<[GetAdminCategoryListResponse[], number]> {
    const [categoryEntityList, total] =
      await this.categoryRepositoryService.findCategoryByFilter(
        request.page,
        request.pageSize,
        request.searchName,
        request.searchColumn,
        request.sort,
      );

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const categoryList = await Promise.all(
      categoryEntityList.map(async (categoryEntity) => {
        const nameDto = await Promise.all(
          languageArray.map(async (languageEntity) => {
            const multilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.CATEGORY,
                categoryEntity.id,
                languageEntity.code,
                'name',
              );
            if (multilingualText.length > 0) {
              return GetAdminCategoryNameDto.from(
                languageEntity.code,
                multilingualText[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminCategoryListResponse.from(categoryEntity, nameDto);
      }),
    );

    return [categoryList, total];
  }
}

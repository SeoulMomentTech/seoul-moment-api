import { CategoryEntity } from '@app/repository/entity/category.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  AdminCategoryListRequest,
  GetAdminCategoryListResponse,
  GetAdminCategoryNameDto,
  PostAdminCategoryRequest,
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
        request.count,
        request.search,
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

  @Transactional()
  async postAdminCategory(dto: PostAdminCategoryRequest) {
    const categoryEntity = await this.categoryRepositoryService.insert(
      plainToInstance(CategoryEntity, {}),
    );

    await Promise.all(
      dto.list.flatMap((v) => [
        this.languageRepositoryService.saveMultilingualText(
          EntityType.CATEGORY,
          categoryEntity.id,
          'name',
          v.languageId,
          v.name,
        ),
      ]),
    );
  }
}

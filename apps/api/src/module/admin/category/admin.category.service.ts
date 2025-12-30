import { OpenaiService } from '@app/external/openai/openai.service';
import { UpdateCategoryDto } from '@app/repository/dto/category.dto';
import { CategoryEntity } from '@app/repository/entity/category.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageName } from '@app/repository/enum/language.enum';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  AdminCategoryListRequest,
  GetAdminCategoryResponse,
  GetAdminCategoryNameDto,
  PostAdminCategoryRequest,
  UpdateAdminCategoryRequest,
} from './admin.category.dto';

@Injectable()
export class AdminCategoryService {
  constructor(
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly openaiService: OpenaiService,
  ) {}

  async getAdminCategoryList(
    request: AdminCategoryListRequest,
  ): Promise<[GetAdminCategoryResponse[], number]> {
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
        return GetAdminCategoryResponse.from(categoryEntity, nameDto);
      }),
    );

    return [categoryList, total];
  }

  @Transactional()
  async postAdminCategory(dto: PostAdminCategoryRequest) {
    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const translatedNames = await Promise.all(
      languageArray.map(async (languageEntity) => {
        const translatedName = await this.openaiService.translate(
          dto.name,
          languageEntity.name as LanguageName,
        );
        return {
          languageId: languageEntity.id,
          name: translatedName,
        };
      }),
    );

    const categoryEntity = await this.categoryRepositoryService.insert(
      plainToInstance(CategoryEntity, {}),
    );

    await Promise.all(
      translatedNames.map((v) => [
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

  async deleteAdminCategory(id: number) {
    await this.categoryRepositoryService.getCategoryById(id);
    await this.categoryRepositoryService.deleteCategoryById(id);
  }

  @Transactional()
  async updateAdminCategory(id: number, dto: UpdateAdminCategoryRequest) {
    await this.categoryRepositoryService.getCategoryById(id);

    const updateDto: UpdateCategoryDto = {
      id,
      sortOrder: dto.sortOrder,
    };

    await this.categoryRepositoryService.updateCategory(updateDto);

    if (dto.list && dto.list.length > 0) {
      await Promise.all(
        dto.list.flatMap((v) => [
          this.languageRepositoryService.saveMultilingualText(
            EntityType.CATEGORY,
            id,
            'name',
            v.languageId,
            v.name,
          ),
        ]),
      );
    }
  }

  async getAdminCategoryInfo(id: number): Promise<GetAdminCategoryResponse> {
    const categoryEntity =
      await this.categoryRepositoryService.getCategoryById(id);

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

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
    return GetAdminCategoryResponse.from(categoryEntity, nameDto);
  }
}

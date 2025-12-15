import { PagingDto } from '@app/common/dto/global.dto';
import { OptionSortDto, UpdateOptionDto } from '@app/repository/dto/option.dto';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { OptionSortColumn } from '@app/repository/enum/option.repository.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminProductOptionInfoResponse,
  GetAdminProductOptionNameDto,
  GetAdminProductOptionRequest,
  GetAdminProductOptionResponse,
  PatchAdminProductOptionRequest,
  PostAdminProductOptionRequest,
} from './admin.product.option.dto';

@Injectable()
export class AdminProductOptionService {
  constructor(
    private readonly optionRepositoryService: OptionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getAdminProductOptionList(
    dto: GetAdminProductOptionRequest,
  ): Promise<[GetAdminProductOptionResponse[], number]> {
    const [options, total] =
      await this.optionRepositoryService.findOptionByFilter(
        PagingDto.from(dto.page, dto.count),
        OptionSortDto.from(OptionSortColumn.CREATE, dto.sort),
        dto.search,
      );

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const optionList = await Promise.all(
      options.map(async (option) => {
        const nameDto = await Promise.all(
          languages.map(async (language) => {
            const multilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.OPTION,
                option.id,
                language.code,
                'name',
              );
            if (multilingualText.length > 0) {
              return GetAdminProductOptionNameDto.from(
                language.code,
                multilingualText[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminProductOptionResponse.from(option, nameDto);
      }),
    );

    return [optionList, total];
  }

  @Transactional()
  async postAdminProductOption(dto: PostAdminProductOptionRequest) {
    const optionEntity = await this.optionRepositoryService.insertOption(
      plainToInstance(OptionEntity, {
        type: dto.type,
        uiType: dto.uiType,
      }),
    );

    for (const text of dto.text) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.OPTION,
        optionEntity.id,
        'name',
        text.languageId,
        text.name,
      );
    }
  }

  @Transactional()
  async deleteAdminProductOption(id: number) {
    await this.optionRepositoryService.deleteOption(id);

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.OPTION,
      id,
    );
  }

  @Transactional()
  async patchAdminProductOption(
    id: number,
    dto: PatchAdminProductOptionRequest,
  ) {
    const updateOptionDto: UpdateOptionDto = {
      id,
      type: dto.type,
      uiType: dto.uiType,
      isActive: dto.isActive,
    };

    await this.optionRepositoryService.updateOption(updateOptionDto);

    if (dto.text && dto.text.length > 0) {
      for (const text of dto.text) {
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.OPTION,
          id,
          'name',
          text.languageId,
          text.name,
        );
      }
    }
  }

  async getAdminProductOptionInfo(
    id: number,
  ): Promise<GetAdminProductOptionInfoResponse> {
    const optionEntity = await this.optionRepositoryService.getOptionById(id);

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const nameDto = await Promise.all(
      languages.map(async (language) => {
        const multilingualText =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.OPTION,
            id,
            language.code,
            'name',
          );

        if (multilingualText.length > 0) {
          return GetAdminProductOptionNameDto.from(
            language.code,
            multilingualText[0].textContent,
          );
        }

        return null;
      }),
    );

    return GetAdminProductOptionInfoResponse.from(optionEntity, nameDto);
  }
}

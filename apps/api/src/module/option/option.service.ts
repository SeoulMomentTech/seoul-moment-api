import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { Injectable } from '@nestjs/common';

import { GetOptionResponse, GetOptionValueResponse } from './option.dto';

@Injectable()
export class OptionService {
  constructor(
    private readonly optionRepositoryService: OptionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getOption(): Promise<GetOptionResponse[]> {
    const optionEntites = await this.optionRepositoryService.getOption();

    return optionEntites.map((v) => GetOptionResponse.from(v));
  }

  async getOptionValue(
    optionId: number,
    language: LanguageCode,
  ): Promise<GetOptionValueResponse[]> {
    const optionValueEntites =
      await this.optionRepositoryService.getOptionValueByOptionId(optionId);

    const optionValueText =
      await this.languageRepositoryService.findMultilingualTexts(
        EntityType.OPTION_VALUE,
        optionValueEntites[0].id,
        language,
      );

    return optionValueEntites.map((v) =>
      GetOptionValueResponse.from(v, optionValueText),
    );
  }
}

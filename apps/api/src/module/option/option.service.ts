import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { Injectable } from '@nestjs/common';

import { GetOptionResponse } from './option.dto';

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
}

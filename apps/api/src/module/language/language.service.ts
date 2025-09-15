import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import { GetAvaliableLanguageResponse } from './language.dto';

@Injectable()
export class LanguageService {
  constructor(
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getAvaliableLanguage(): Promise<GetAvaliableLanguageResponse[]> {
    const languageEntites =
      await this.languageRepositoryService.findAllActiveLanguages();

    return languageEntites.map((v) => GetAvaliableLanguageResponse.from(v));
  }
}

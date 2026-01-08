import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { HomeRepositoryService } from '@app/repository/service/home.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import { GetHomeResponse } from './home.dto';

@Injectable()
export class HomeService {
  constructor(
    private readonly homeRepositoryService: HomeRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getHome(language: LanguageCode): Promise<GetHomeResponse> {
    const homeEntity = await this.homeRepositoryService.findHome();

    const homeSectionText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.HOME_SECTION,
        homeEntity.section.map((v) => v.id),
        language,
      );

    return GetHomeResponse.from(
      homeEntity.banner,
      homeEntity.section,
      homeSectionText,
    );
  }
}

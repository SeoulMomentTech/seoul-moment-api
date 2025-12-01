import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Injectable } from '@nestjs/common';

import {
  AdminNewsListRequest,
  GetAdminNewsResponse,
  GetAdminNewsTextDto,
} from './admin.news.dto';

@Injectable()
export class AdminNewsService {
  constructor(
    private readonly newsRepositoryService: NewsRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getAdminNewsList(
    request: AdminNewsListRequest,
  ): Promise<[GetAdminNewsResponse[], number]> {
    const [newsEntityList, total] =
      await this.newsRepositoryService.findNewsByFilter(
        request.page,
        request.count,
        request.search,
        request.searchColumn,
        request.sort,
      );

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const newsList = await Promise.all(
      newsEntityList.map(async (newsEntity) => {
        const nameDto = await Promise.all(
          languageArray.map(async (languageEntity) => {
            const multilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.NEWS,
                newsEntity.id,
                languageEntity.code,
                'title',
              );
            if (multilingualText.length > 0) {
              return GetAdminNewsTextDto.from(
                languageEntity.code,
                multilingualText[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminNewsResponse.from(newsEntity, nameDto);
      }),
    );

    return [newsList, total];
  }
}

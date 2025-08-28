import { Configuration } from '@app/config/configuration';
import { HttpRequestService } from '@app/http/http.service';
import { Injectable } from '@nestjs/common';

import { NewsItemDto, SearchRequestDto, SearchResultDto } from './serper.dto';

@Injectable()
export class SerperService {
  constructor(private readonly httpRequestService: HttpRequestService) {}

  async requestGoogleNews(search: string): Promise<SearchResultDto> {
    const { data } =
      await this.httpRequestService.sendPostRequest<SearchResultDto>(
        `${Configuration.getConfig().SERPER_URL}/news`,
        SearchRequestDto.fromGoogleNews(search),
        {
          'X-API-KEY': Configuration.getConfig().SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
      );

    return SearchResultDto.from(
      data.searchParameters,
      data.news.map((v) =>
        NewsItemDto.from(
          search,
          v.title,
          v.link,
          v.snippet,
          v.date,
          v.source,
          v.imageUrl,
        ),
      ),
      data.credits,
    );
  }
}

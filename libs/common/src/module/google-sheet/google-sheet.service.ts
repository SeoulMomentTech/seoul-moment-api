import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { ExternalGoogleSheetService } from '@app/external/google/google-sheet.service';
import { NewsItemDto } from '@app/external/serper/serper.dto';
import { SerperService } from '@app/external/serper/serper.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GoogleSheetService {
  private SHEET_NAME = '일간';
  private SHEET_TITLE = 'google-news-crawring';
  private SHEET_OWNER = 'seoulmomenttw@gmail.com';
  private SHEET_ID = '1QfJJ2Y6o0pG3rsPWhukAKIzRi9rWfaNsdYeELJwumU0';

  constructor(
    private readonly externalGoogleSheetService: ExternalGoogleSheetService,
    private readonly cacheService: CacheService,
    private readonly serperService: SerperService,
  ) {}

  async progressGoogleSheet(): Promise<string> {
    const cachedKeywords = await this.cacheService.getList(
      RedisKey.GOOGLE_SHEET_KEYWORD,
    );

    if (cachedKeywords.length < 1)
      throw new ServiceError(
        'no exist keywords',
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    const cachedSheetId = await this.cacheService.find(
      RedisKey.GOOGLE_SHEET_ID,
    );

    let sheetId =
      Configuration.getConfig().NODE_ENV === SupportEnv.DEV
        ? this.SHEET_ID
        : cachedSheetId;

    if (!sheetId) {
      sheetId = await this.getNewSheetId();
      await this.cacheService.set(RedisKey.GOOGLE_SHEET_ID, sheetId);
    }

    this.externalGoogleSheetService.setSpreadsheetId(sheetId);

    const newsList = await this.getNewList(cachedKeywords);
    await this.insertNewsDataInSheet(newsList, cachedSheetId);

    return sheetId;
  }

  private async getNewSheetId(): Promise<string> {
    const sheetId = await this.externalGoogleSheetService.createSpreadsheet(
      this.SHEET_TITLE,
      this.SHEET_OWNER,
      this.SHEET_NAME,
    );

    await this.cacheService.set(RedisKey.GOOGLE_SHEET_ID, sheetId);

    return sheetId;
  }

  private async getNewList(cachedKeywords: string[]): Promise<NewsItemDto[]> {
    const serperResponse = await Promise.all(
      cachedKeywords.map((v) => this.serperService.requestGoogleNews(v)),
    );

    return serperResponse.map((v) => v.news).flat();
  }

  private async insertNewsDataInSheet(
    newsList: NewsItemDto[],
    cachedSheetId: string,
  ) {
    if (!cachedSheetId) {
      await this.externalGoogleSheetService.writeRows(
        `${this.SHEET_NAME}!A1`,
        newsList,
      );
    } else {
      const duplicateRemoveNewsList = await this.filterNewsData(newsList);
      await this.externalGoogleSheetService.appendRows(
        `${this.SHEET_NAME}!A1`,
        duplicateRemoveNewsList,
      );
    }
  }

  private async filterNewsData(
    newsList: NewsItemDto[],
  ): Promise<NewsItemDto[]> {
    const sheetData = await this.externalGoogleSheetService.getData(
      `${this.SHEET_NAME}`,
      NewsItemDto,
    );

    if (sheetData.length < 1) return newsList;

    const sheetNewsLinkList = new Set(
      sheetData.map((v) => v.link.split('//')[1]),
    );

    const newNewsList = newsList.filter(
      (v) => !sheetNewsLinkList.has(v.link.split('//')[1]),
    );

    return newNewsList;
  }

  async updateGoogleSheetKeyword(keywordList: string[]) {
    await this.cacheService.del(RedisKey.GOOGLE_SHEET_KEYWORD);

    await Promise.all(
      keywordList.map(
        async (v) =>
          await this.cacheService.rpush(RedisKey.GOOGLE_SHEET_KEYWORD, v),
      ),
    );
  }
}

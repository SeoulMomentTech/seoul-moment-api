/* eslint-disable max-lines-per-function */
import { LoggerModule } from '@app/common/log/logger.module';
import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import {
  NewsItemDto,
  SearchParametersDto,
  SearchResultDto,
} from '@app/external/serper/serper.dto';
import { SerperModule } from '@app/external/serper/serper.module';
import { SerperService } from '@app/external/serper/serper.service';
import { HttpRequestModule } from '@app/http/http.module';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';

jest.setTimeout(60_000);

const hasEnv =
  Configuration.getConfig().SERPER_URL !== '' &&
  Configuration.getConfig().SERPER_API_KEY !== '';

const describeOrSkip = hasEnv ? describe : describe.skip;

describeOrSkip('SerperService', () => {
  let serperService: SerperService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [SerperModule, HttpRequestModule, LoggerModule],
    })
      .overrideProvider(LoggerService)
      .useValue({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      })
      .compile();

    serperService = module.get<SerperService>(SerperService);
  });

  beforeEach(() => {
    jest
      .spyOn(serperService, 'requestGoogleNews')
      .mockImplementation(async (q: string): Promise<SearchResultDto> => {
        // create 3 mock news items
        const news = Array.from({ length: 3 }, (_, idx) =>
          plainToInstance(NewsItemDto, {
            title: `mock title ${idx + 1}`,
            link: `https://example.com/news/${idx + 1}`,
            snippet: `mock snippet ${idx + 1}`,
            date: `2025-05-${10 + idx}`,
            source: `mockSource${idx + 1}`,
            imageUrl: `https://pics.example.com/${Math.random()
              .toString(36)
              .substr(2, 8)}.png`,
            position: idx + 1,
          }),
        );

        const searchParameters = plainToInstance(SearchParametersDto, {
          q,
          gl: 'kr',
          hl: 'ko',
          type: 'news',
          engine: 'google',
        });

        return plainToInstance(SearchResultDto, {
          searchParameters,
          news,
          credits: Math.floor(Math.random() * 100),
        });
      });
  });

  it('search 데이터로 뉴스 기사를 가져올 수 있어야 한다 (mocked)', async () => {
    const search = '무신사';
    const result = await serperService.requestGoogleNews(search);

    // 기본 구조 검증
    expect(result).toMatchObject({
      searchParameters: {
        q: search,
        gl: expect.any(String),
        hl: expect.any(String),
        type: expect.any(String),
        engine: expect.any(String),
      },
      credits: expect.any(Number),
      news: expect.any(Array),
    });

    // news 각 아이템 검증
    result.news.forEach((item) => {
      expect(item).toMatchObject({
        title: expect.any(String),
        link: expect.any(String),
        snippet: expect.any(String),
        date: expect.any(String),
        source: expect.any(String),
        imageUrl: expect.any(String),
        position: expect.any(Number),
      });
    });
  });
});

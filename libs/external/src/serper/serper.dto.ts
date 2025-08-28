import { plainToInstance } from 'class-transformer';
import moment from 'moment-timezone';

export class SearchParametersDto {
  q: string;
  gl: string;
  hl: string;
  type: string;
  engine: string;
}

export class NewsItemDto {
  keyword: string;
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
  imageUrl: string;

  static from(
    keyword: string,
    title: string,
    link: string,
    snippet: string,
    date: string,
    source: string,
    imageUrl: string,
  ): NewsItemDto {
    const rules: [RegExp, moment.unitOfTime.DurationConstructor][] = [
      [/(\d+)\s*초 전/, 'seconds'],
      [/(\d+)\s*분 전/, 'minutes'],
      [/(\d+)\s*시간 전/, 'hours'],
      [/(\d+)\s*일 전/, 'days'],
      [/(\d+)\s*주 전/, 'weeks'],
      [/(\d+)\s*개월 전/, 'months'],
      [/(\d+)\s*년 전/, 'years'],
    ];

    for (const [re, unit] of rules) {
      const m = date.match(re);
      if (m) {
        date = moment()
          .subtract(Number(m[1]), unit)
          .format('YYYY-MM-DD HH:mm:ss');
      }
    }

    return plainToInstance(this, {
      keyword,
      title,
      link,
      snippet,
      date,
      source,
      imageUrl,
    });
  }
}

export class SearchResultDto {
  searchParameters: SearchParametersDto;
  news: NewsItemDto[];
  credits: number;

  static from(
    searchParameters: SearchParametersDto,
    news: NewsItemDto[],
    credits: number,
  ): SearchResultDto {
    return plainToInstance(this, { searchParameters, news, credits });
  }
}

export class SearchRequestDto {
  q: string;
  gl: string;
  hl: string;
  tbs: string;

  static from(
    q: string,
    gl: string,
    hl: string,
    tbs: string,
  ): SearchRequestDto {
    return plainToInstance(this, { q, gl, hl, tbs });
  }

  static fromGoogleNews(q: string): SearchRequestDto {
    return plainToInstance(this, { q, gl: 'kr', hl: 'ko', tbs: 'qdr:d' });
  }
}

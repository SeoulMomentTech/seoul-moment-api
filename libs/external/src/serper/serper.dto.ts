import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import moment from 'moment-timezone';

export class SearchParametersDto {
  @ApiProperty({ description: 'Search query', example: 'seoul moment' })
  q: string;

  @ApiProperty({ description: 'Country code', example: 'kr' })
  gl: string;

  @ApiProperty({ description: 'Language code', example: 'ko' })
  hl: string;

  @ApiProperty({ description: 'Search type', example: 'news' })
  type: string;

  @ApiProperty({ description: 'Search engine', example: 'google' })
  engine: string;
}

export class NewsItemDto {
  @ApiProperty({ description: 'Search keyword', example: 'seoul moment' })
  keyword: string;

  @ApiProperty({
    description: 'News title',
    example: 'Seoul Moment Brand Launch',
  })
  title: string;

  @ApiProperty({
    description: 'News article URL',
    example: 'https://example.com/news/1',
  })
  link: string;

  @ApiProperty({
    description: 'News snippet',
    example: 'Seoul Moment brand launched...',
  })
  snippet: string;

  @ApiProperty({
    description: 'Publication date',
    example: '2025-09-02 10:30:00',
  })
  date: string;

  @ApiProperty({ description: 'News source', example: 'Korea Herald' })
  source: string;

  @ApiProperty({
    description: 'News image URL',
    example: 'https://example.com/image.jpg',
  })
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

    return plainToInstance(NewsItemDto, {
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
  @ApiProperty({ description: 'Search parameters', type: SearchParametersDto })
  searchParameters: SearchParametersDto;

  @ApiProperty({ description: 'News items', type: [NewsItemDto] })
  news: NewsItemDto[];

  @ApiProperty({ description: 'API credits used', example: 1 })
  credits: number;

  static from(
    searchParameters: SearchParametersDto,
    news: NewsItemDto[],
    credits: number,
  ): SearchResultDto {
    return plainToInstance(SearchResultDto, {
      searchParameters,
      news,
      credits,
    });
  }
}

export class SearchRequestDto {
  @ApiProperty({ description: 'Search query', example: 'seoul moment' })
  q: string;

  @ApiProperty({ description: 'Country code', example: 'kr' })
  gl: string;

  @ApiProperty({ description: 'Language code', example: 'ko' })
  hl: string;

  @ApiProperty({ description: 'Time filter', example: 'qdr:d' })
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

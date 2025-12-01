import { NewsEntity } from '@app/repository/entity/news.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { NewsSearchEnum } from '@app/repository/enum/news.repository.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsOptional, IsEnum } from 'class-validator';

import { ListFilterDto } from '../admin.dto';

export class AdminNewsListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '검색 칼럼',
    example: NewsSearchEnum.TITLE,
    enum: NewsSearchEnum,
  })
  @IsOptional()
  @IsEnum(NewsSearchEnum)
  searchColumn: NewsSearchEnum;
}

export class GetAdminNewsTextDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '뉴스 제목',
    example: 'Seoul Moment Brand Launch',
  })
  title: string;

  static from(languageCode: LanguageCode, title: string) {
    return plainToInstance(this, {
      languageCode,
      title,
    });
  }
}

export class GetAdminNewsResponse {
  @ApiProperty({
    description: '뉴스 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '뉴스 텍스트 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '서울모먼트',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Seoul Moment',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '首爾時刻',
      },
    ],
    type: [GetAdminNewsTextDto],
  })
  textDto: GetAdminNewsTextDto[];

  static from(entity: NewsEntity, textDto: GetAdminNewsTextDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      textDto,
    });
  }
}

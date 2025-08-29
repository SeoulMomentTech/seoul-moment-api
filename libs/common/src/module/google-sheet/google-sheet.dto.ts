import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class PostGoogleSheetKeywordRequest {
  @ApiProperty({
    description: '키워드 리스트',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['키워드1', '키워드2', '키워드3'],
  })
  @IsArray()
  @IsString({ each: true })
  keywordList: string[];
}

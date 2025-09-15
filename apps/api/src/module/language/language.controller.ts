import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { GetAvaliableLanguageResponse } from './language.dto';
import { LanguageService } from './language.service';

@Controller('language')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  @Get()
  @ApiOperation({
    summary: '활성 언어 목록 조회',
    description: '사용 가능한 활성 언어 목록을 반환합니다.',
  })
  @ResponseList(GetAvaliableLanguageResponse)
  async getActiveLanguage(): Promise<
    ResponseListDto<GetAvaliableLanguageResponse>
  > {
    const result = await this.languageService.getAvaliableLanguage();

    return new ResponseListDto(result);
  }
}

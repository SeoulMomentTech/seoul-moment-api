import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Controller, Get, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import { GetCategoryResponse } from './category.dto';
import { CategoryService } from './category.service';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Categories with Multilingual Support',
    description:
      'Returns categories in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetCategoryResponse)
  async getCategory(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetCategoryResponse>> {
    const result = await this.categoryService.getCategory(acceptLanguage);

    return new ResponseListDto(result);
  }
}

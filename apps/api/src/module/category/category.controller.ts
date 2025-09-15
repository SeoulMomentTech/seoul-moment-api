import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import { GetCategoryResponse, PostCategoryRequest } from './category.dto';
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

  @Post()
  @ApiOperation({
    summary: '카테고리 다국어 등록',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postCategory(@Body() body: PostCategoryRequest) {
    await this.categoryService.postCategory(body);
  }
}

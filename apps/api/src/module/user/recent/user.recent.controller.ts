import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';

import {
  GetUserRecentProductResponse,
  GetUserRecentRequest,
  PostUserRecentRequest,
} from './user.recent.dto';
import { UserRecentService } from './user.recent.service';

@Controller('user/recent')
export class UserRecentController {
  constructor(private readonly userRecentService: UserRecentService) {}

  @Post()
  @ApiOperation({ summary: '유저 최근 본 상품 추가' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error')
  @ResponseException(HttpStatus.BAD_REQUEST, 'Bad request')
  @ResponseException(HttpStatus.NOT_FOUND, 'Product item not found')
  async postUserRecent(
    @Request() req: any,
    @Body() body: PostUserRecentRequest,
  ): Promise<void> {
    await this.userRecentService.postUserRecent(req.user.id, body);
  }

  @Get()
  @ApiOperation({
    summary: '유저 최근 본 상품 목록 조회',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseList(GetUserRecentProductResponse)
  async getUserRecentList(
    @Request() req: any,
    @Query() query: GetUserRecentRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetUserRecentProductResponse>> {
    const [result, total] = await this.userRecentService.getUserRecentList(
      req.user.id,
      query,
      acceptLanguage,
    );

    return new ResponseListDto(result, total);
  }

  @Get('recommend')
  @ApiOperation({
    summary: '유저 최근 본 상품 기반 추천 상품 목록 조회',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseList(GetUserRecentProductResponse)
  async getUserRecentRecommendList(
    @Request() req: any,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetUserRecentProductResponse>> {
    const result = await this.userRecentService.getTopProductCategory(
      req.user.id,
      acceptLanguage,
    );

    return new ResponseListDto(result);
  }
}

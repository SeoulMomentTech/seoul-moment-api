import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';

import {
  GetUserBrandLikeRequest,
  GetUserBrandLikeResponse,
  GetUserProductLikeRequest,
  GetUserProductLikeResponse,
  PostUserBrandLikeRequest,
  PostUserProductLikeRequest,
} from './user.like.dto';
import { UserLikeService } from './user.like.service';

@Controller('user/like')
export class UserLikeController {
  constructor(private readonly userLikeService: UserLikeService) {}

  @Post('product')
  @ApiOperation({ summary: '유저 상품 좋아요 추가' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.CONFLICT, 'Already liked product item')
  @ResponseException(HttpStatus.NOT_FOUND, 'Product item not found')
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error')
  @ResponseException(HttpStatus.BAD_REQUEST, 'Bad request')
  async postUserProductLike(
    @Request() req: any,
    @Body() body: PostUserProductLikeRequest,
  ): Promise<void> {
    await this.userLikeService.createUserProductLike(
      req.user.id,
      body.productItemId,
    );
  }

  @Post('brand')
  @ApiOperation({ summary: '유저 브랜드 좋아요 추가' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.CONFLICT, 'Already liked brand')
  @ResponseException(HttpStatus.NOT_FOUND, 'Brand not found')
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error')
  @ResponseException(HttpStatus.BAD_REQUEST, 'Bad request')
  async postUserBrandLike(
    @Request() req: any,
    @Body() body: PostUserBrandLikeRequest,
  ): Promise<void> {
    await this.userLikeService.createUserBrandLike(req.user.id, body.brandId);
  }

  @Delete('product/:id(\\d+)')
  @ApiOperation({ summary: '유저 상품 좋아요 삭제' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserProductLike(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userLikeService.deleteUserProductLike(req.user.id, id);
  }

  @Delete('brand/:id(\\d+)')
  @ApiOperation({ summary: '유저 브랜드 좋아요 삭제' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserBrandLike(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userLikeService.deleteUserBrandLike(req.user.id, id);
  }

  @Get('product')
  @ApiOperation({
    summary: '유저 상품 좋아요 목록 조회',
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
  @ResponseList(GetUserProductLikeResponse)
  async getUserProductLikeList(
    @Request() req: any,
    @Query() query: GetUserProductLikeRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetUserProductLikeResponse>> {
    const [result, total] = await this.userLikeService.getUserProductLikeList(
      req.user.id,
      query,
      acceptLanguage,
    );
    return new ResponseListDto(result, total);
  }

  @Get('brand')
  @ApiOperation({
    summary: '유저 브랜드 좋아요 목록 조회',
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
  @ResponseList(GetUserBrandLikeResponse)
  async getUserBrandLikeList(
    @Request() req: any,
    @Query() query: GetUserBrandLikeRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetUserBrandLikeResponse>> {
    const [result, total] = await this.userLikeService.getUserBrandLikeList(
      req.user.id,
      query,
      acceptLanguage,
    );

    return new ResponseListDto(result, total);
  }
}

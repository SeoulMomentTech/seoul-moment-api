import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';

import {
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
}

import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import {
  GetUserFitResponse,
  GetUserInfoResponse,
  GetUserProfileResponse,
  PatchUserFitRequest,
  PatchUserInfoRequest,
  PatchUserProfileRequest,
  PostUserFitRequest,
  PostUserProfileRequest,
} from './user.dto';
import { UserService } from './user.service';
import { UserOneTimeTokenGuard } from '../../guard/user-one-time-token.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('info')
  @ApiOperation({ summary: '유저 정보 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetUserInfoResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 정보 없음')
  async getUserInfo(
    @Request() req: any,
  ): Promise<ResponseDataDto<GetUserInfoResponse>> {
    const result = await this.userService.getUserInfo(req.user.id);

    return new ResponseDataDto(result);
  }

  @Patch('info')
  @ApiOperation({ summary: '유저 정보 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 정보 없음')
  async patchUserInfo(@Request() req: any, @Body() body: PatchUserInfoRequest) {
    await this.userService.patchUserInfo(req.user.id, body);
  }

  @Post('profile')
  @ApiOperation({ summary: '유저 프로필 생성' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 없음')
  async postUserProfile(
    @Request() req: any,
    @Body() body: PostUserProfileRequest,
  ) {
    await this.userService.postUserProfile(req.user.id, body);
  }

  @Patch('profile')
  @ApiOperation({ summary: '유저 프로필 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 없음')
  async patchUserProfile(
    @Request() req: any,
    @Body() body: PatchUserProfileRequest,
  ) {
    await this.userService.patchUserProfile(req.user.id, body);
  }

  @Get('profile')
  @ApiOperation({ summary: '유저 프로필 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetUserProfileResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 없음')
  async getUserProfile(
    @Request() req: any,
  ): Promise<ResponseDataDto<GetUserProfileResponse>> {
    const result = await this.userService.getUserProfile(req.user.id);

    return new ResponseDataDto(result);
  }

  @Post('fit')
  @ApiOperation({ summary: '유저 체형 정보 생성' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 체형 정보 없음')
  async postUserFit(@Request() req: any, @Body() body: PostUserFitRequest) {
    await this.userService.postUserFit(req.user.id, body);
  }

  @Patch('fit')
  @ApiOperation({ summary: '유저 체형 정보 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 체형 정보 없음')
  async patchUserFit(@Request() req: any, @Body() body: PatchUserFitRequest) {
    await this.userService.patchUserFit(req.user.id, body);
  }

  @Get('fit')
  @ApiOperation({ summary: '유저 체형 정보 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetUserFitResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 체형 정보 없음')
  async getUserFit(
    @Request() req: any,
  ): Promise<ResponseDataDto<GetUserFitResponse>> {
    const result = await this.userService.getUserFit(req.user.id);
    return new ResponseDataDto(result);
  }

  @Delete('fit')
  @ApiOperation({ summary: '유저 체형 정보 삭제' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 체형 정보 없음')
  async deleteUserFit(@Request() req: any) {
    await this.userService.deleteUserFit(req.user.id);
  }
}

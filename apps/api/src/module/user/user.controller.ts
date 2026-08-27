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
  PatchUserProfileNameRequest,
  PatchUserProfileNicknameRequest,
  PatchUserProfileRequest,
  PostUserFitRequest,
  PostUserProfileImageRequest,
  PostUserProfileRequest,
} from './user.dto';
import { UserService } from './user.service';
import { UserWithdrawService } from './withdraw/user.withdraw.service';
import { UserOneTimeTokenGuard } from '../../guard/user-one-time-token.guard';

const WITHDRAW_DESCRIPTION = `회원을 탈퇴 처리한다.

- 이메일/닉네임/전화번호 등 식별정보는 익명값으로 치환되고 계정은 소프트 삭제된다.
- SNS 연동, 좋아요(브랜드/상품/룩북), 최근 본 상품, 프로필 이미지는 즉시 삭제된다.
- 발급된 액세스·리프레시 토큰은 즉시 무효화되어 이후 요청은 401을 받는다.
- 탈퇴한 이메일·전화번호로 다시 가입할 수 있다.
- 복구되지 않으니 클라이언트에서 반드시 확인 절차를 거칠 것.`;

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userWithdrawService: UserWithdrawService,
  ) {}

  @Delete()
  @ApiOperation({
    summary: '회원 탈퇴',
    description: WITHDRAW_DESCRIPTION,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료 또는 이미 탈퇴한 회원')
  @ResponseException(HttpStatus.NOT_FOUND, '유저 정보 없음')
  async deleteUser(@Request() req: any) {
    await this.userWithdrawService.withdraw(req.user.id);
  }

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
  @ApiOperation({ summary: '유저 프로필 생성', deprecated: true })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 없음')
  @ResponseException(HttpStatus.CONFLICT, '이미 존재하는 닉네임')
  async postUserProfile(
    @Request() req: any,
    @Body() body: PostUserProfileRequest,
  ) {
    await this.userService.postUserProfile(req.user.id, body);
  }

  @Patch('profile/nickname')
  @ApiOperation({ summary: '유저 닉네임 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 없음')
  @ResponseException(HttpStatus.CONFLICT, '이미 존재하는 닉네임')
  async patchUserProfileNickname(
    @Request() req: any,
    @Body() body: PatchUserProfileNicknameRequest,
  ) {
    await this.userService.patchUserProfileNickname(req.user.id, body);
  }

  @Patch('profile/name')
  @ApiOperation({ summary: '유저 이름 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 없음')
  @ResponseException(HttpStatus.CONFLICT, '이미 존재하는 이름')
  async patchUserProfileName(
    @Request() req: any,
    @Body() body: PatchUserProfileNameRequest,
  ) {
    await this.userService.patchUserProfileName(req.user.id, body);
  }

  @Patch('profile')
  @ApiOperation({ summary: '유저 프로필 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 없음')
  @ResponseException(HttpStatus.CONFLICT, '이미 존재하는 닉네임')
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
  @ResponseException(HttpStatus.NOT_FOUND, '유저 없음')
  async getUserProfile(
    @Request() req: any,
  ): Promise<ResponseDataDto<GetUserProfileResponse>> {
    const result = await this.userService.getUserProfile(req.user.id);

    return new ResponseDataDto(result);
  }

  @Post('profile/image')
  @ApiOperation({
    summary: '유저 프로필 이미지 등록 (기존 이미지가 있으면 교체)',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  async postUserProfileImage(
    @Request() req: any,
    @Body() body: PostUserProfileImageRequest,
  ) {
    await this.userService.postUserProfileImage(req.user.id, body);
  }

  @Delete('profile/image')
  @ApiOperation({ summary: '유저 프로필 이미지 삭제' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.NOT_FOUND, '유저 프로필 이미지 없음')
  async deleteUserProfileImage(@Request() req: any) {
    await this.userService.deleteUserProfileImage(req.user.id);
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

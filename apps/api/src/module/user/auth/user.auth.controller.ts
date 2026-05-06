import { JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Configuration } from '@app/config/configuration';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';
import { UserRefreshTokenGuard } from 'apps/api/src/guard/user-refresh-token.guard';
import { plainToInstance } from 'class-transformer';

import {
  GetUserOneTimeTokenResponse,
  PatchPasswordRequest,
  PostUserLoginRequest,
  PostUserLoginResponse,
  PostUserPasswordEmailVerifyResponse,
  PostUserSignUpRequest,
} from './user.auth.dto';
import { UserAuthService } from './user.auth.service';
import {
  PostEmailCodeRequest,
  PostEmailVerifyRequest,
} from '../../auth/auth.dto';

@Controller('user/auth')
export class UserAuthController {
  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly commonAuthService: CommonAuthService,
  ) {}

  @Post('signup')
  @ApiOperation({ summary: '유저 회원가입' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postUserSignUp(@Body() body: PostUserSignUpRequest): Promise<void> {
    await this.userAuthService.signUp(body);
  }

  @Post('login')
  @ApiOperation({ summary: '유저 로그인' })
  @ResponseData(PostUserLoginResponse)
  async postUserLogin(
    @Body() body: PostUserLoginRequest,
  ): Promise<ResponseDataDto<PostUserLoginResponse>> {
    const loginResponse = await this.userAuthService.login(body);

    return new ResponseDataDto(loginResponse);
  }

  @Get('one-time-token')
  @ApiOperation({
    summary: 'one time jwt token 재발급',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserRefreshTokenGuard)
  @ResponseException(
    HttpStatus.FORBIDDEN,
    'Refresh token 만료 및 변조 -> 로그인 필요',
  )
  @ResponseData(GetUserOneTimeTokenResponse)
  async getOneTimeToken(
    @Request() req: any,
  ): Promise<ResponseDataDto<GetUserOneTimeTokenResponse>> {
    const oneTimeToken = await this.commonAuthService.generateJwt(
      { id: req.user.id },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );

    return new ResponseDataDto(
      plainToInstance(GetUserOneTimeTokenResponse, { oneTimeToken }),
    );
  }

  @Post('email/code')
  @ApiOperation({ summary: '회원 가입용 이메일 인증 코드 발송' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.CONFLICT, '이미 가입된 이메일')
  async postEmailCode(@Body() body: PostEmailCodeRequest) {
    await this.userAuthService.postEmailCode(body.email);
  }

  @Post('password/email/code')
  @ApiOperation({ summary: '비밀번호 찾기 이메일 인증 코드 발송' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.NOT_FOUND, '존재 하지 않는 이메일')
  async postPasswordEmailCode(@Body() body: PostEmailCodeRequest) {
    await this.userAuthService.postPasswordEmailCode(body.email);
  }

  @Post('password/email/verify')
  @ApiOperation({
    summary: '비밀번호 찾기 이메일 인증 코드 검증',
    description:
      '검증 성공 시 비밀번호 변경에 사용할 one time token을 반환합니다.',
  })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.UNAUTHORIZED, '인증 코드 만료 또는 불일치')
  @ResponseException(HttpStatus.NOT_FOUND, '존재 하지 않는 이메일')
  @ResponseData(PostUserPasswordEmailVerifyResponse)
  async postPasswordEmailVerify(
    @Body() body: PostEmailVerifyRequest,
  ): Promise<ResponseDataDto<PostUserPasswordEmailVerifyResponse>> {
    const result = await this.userAuthService.postPasswordEmailVerify(
      body.email,
      parseInt(body.code, 10),
    );

    return new ResponseDataDto(
      plainToInstance(PostUserPasswordEmailVerifyResponse, result),
    );
  }

  @Patch('password')
  @ApiOperation({
    summary: '비밀번호 변경',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, 'one time token 만료 및 변조')
  async patchPassword(
    @Request() req: any,
    @Body() body: PatchPasswordRequest,
  ): Promise<void> {
    await this.userAuthService.patchPassword(req.user.id, body.password);
  }
}

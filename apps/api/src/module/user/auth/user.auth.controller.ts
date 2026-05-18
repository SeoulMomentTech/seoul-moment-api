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
  PostGoogleLinkRequest,
  PostGoogleLoginRequest,
  PostGoogleLoginResponse,
  PostGoogleSignupRequest,
  PostNicknameValidateRequest,
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

const GOOGLE_AUTH_FLOW = `**Google 인증 전체 플로우**

1. POST /user/auth/google/login { idToken }
   - 이미 연결된 계정 → 200 { needsLinkConfirm: false, token, refreshToken } (로그인 완료)
   - 가입됨 + Google 미연결 → 200 { needsLinkConfirm: true, email, linkToken } → 2-A
   - 미가입(신규) → 200 { needsLinkConfirm: false, needsSignup: true, email, signupToken } → 2-B
2. 다음 단계
   - 2-A. 연결 확인 모달 → POST /user/auth/google/link { linkToken }
   - 2-B. 닉네임/약관 입력 → POST /user/auth/google/signup { signupToken, nickname, ...약관동의 }
3. link / signup 성공 → 200 { token, refreshToken } (로그인 완료)

판단 기준: 응답에 token이 있으면 즉시 로그인. 없으면 needsLinkConfirm / needsSignup으로 다음 단계 결정. 모든 정상 분기는 HTTP 200 (가입 여부로 404 미반환). linkToken 5분 / signupToken 10분 만료.`;

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

  @Post('google/login')
  @ApiOperation({
    summary: 'Google 로그인 / 연결확인 / 신규가입 분기',
    description:
      GOOGLE_AUTH_FLOW +
      '\n\n▶ 현재 API: **1단계** — idToken 검증 후 ' +
      '로그인 / 연결확인(linkToken) / 신규가입(signupToken) 분기 판단',
  })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.UNAUTHORIZED, '유효하지 않은 Google idToken')
  @ResponseData(PostGoogleLoginResponse)
  async postGoogleLogin(
    @Body() body: PostGoogleLoginRequest,
  ): Promise<ResponseDataDto<PostGoogleLoginResponse>> {
    const result = await this.userAuthService.googleLogin(body.idToken);

    return new ResponseDataDto(
      plainToInstance(PostGoogleLoginResponse, result),
    );
  }

  @Post('google/link')
  @ApiOperation({
    summary: 'Google 계정 연결 (2-A단계)',
    description:
      GOOGLE_AUTH_FLOW +
      '\n\n▶ 현재 API: **2-A 단계** — 기존 계정에 user_sns 행을 ' +
      '추가(연결)하고 access/refresh 토큰을 발급한다. ' +
      'linkToken은 google/login 응답에서 받는다.',
  })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.UNAUTHORIZED, 'linkToken 만료 또는 변조')
  @ResponseException(HttpStatus.CONFLICT, '이미 다른 계정에 연결된 Google 계정')
  @ResponseData(PostUserLoginResponse)
  async postGoogleLink(
    @Body() body: PostGoogleLinkRequest,
  ): Promise<ResponseDataDto<PostUserLoginResponse>> {
    const result = await this.userAuthService.googleLink(body.linkToken);

    return new ResponseDataDto(plainToInstance(PostUserLoginResponse, result));
  }

  @Post('google/signup')
  @ApiOperation({
    summary: 'Google SNS 회원가입 (2-B단계)',
    description:
      GOOGLE_AUTH_FLOW +
      '\n\n▶ 현재 API: **2-B 단계** — signupToken + 닉네임/약관동의로 ' +
      '신규 user + user_sns를 생성하고 access/refresh 토큰을 발급한다. ' +
      'signupToken은 google/login 응답에서 받는다.',
  })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.UNAUTHORIZED, 'signupToken 만료 또는 변조')
  @ResponseException(
    HttpStatus.CONFLICT,
    '이미 존재하는 닉네임 또는 이미 가입된 이메일',
  )
  @ResponseData(PostUserLoginResponse)
  async postGoogleSignup(
    @Body() body: PostGoogleSignupRequest,
  ): Promise<ResponseDataDto<PostUserLoginResponse>> {
    const result = await this.userAuthService.googleSignup(body);

    return new ResponseDataDto(plainToInstance(PostUserLoginResponse, result));
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

  @Post('nickname/validate')
  @ApiOperation({ summary: '닉네임 중복 검사' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.CONFLICT, '이미 존재하는 닉네임')
  async postNicknameValidate(@Body() body: PostNicknameValidateRequest) {
    await this.userAuthService.validateUserNickname(body.nickname);
  }
}

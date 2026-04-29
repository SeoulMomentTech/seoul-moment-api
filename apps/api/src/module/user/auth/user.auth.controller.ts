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
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRefreshTokenGuard } from 'apps/api/src/guard/user-refresh-token.guard';
import { plainToInstance } from 'class-transformer';

import {
  GetUserOneTimeTokenResponse,
  PostUserLoginRequest,
  PostUserLoginResponse,
  PostUserSignUpRequest,
} from './user.auth.dto';
import { UserAuthService } from './user.auth.service';

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
}

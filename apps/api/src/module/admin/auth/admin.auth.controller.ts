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
import { RefreshTokenGuard } from 'apps/api/src/guard/refresh-token.guard';
import { plainToInstance } from 'class-transformer';

import {
  GetOneTimeTokenReponse,
  PostAdminLoginRequest,
  PostAdminLoginResponse,
  PostAdminSignUpRequest,
} from './admin.auth.dto';
import { AdminAuthService } from './admin.auth.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly commonAuthService: CommonAuthService,
  ) {}

  @Post('signup')
  @ApiOperation({ summary: '관리자 회원가입' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postAdminSignUp(@Body() body: PostAdminSignUpRequest) {
    return this.adminAuthService.signUp(body);
  }

  @Post('login')
  @ApiOperation({ summary: '관리자 로그인' })
  @HttpCode(HttpStatus.OK)
  @ResponseData(PostAdminLoginResponse)
  async postAdminLogin(
    @Body() body: PostAdminLoginRequest,
  ): Promise<ResponseDataDto<PostAdminLoginResponse>> {
    const loginResponse = await this.adminAuthService.login(body);

    return new ResponseDataDto(loginResponse);
  }

  @Get('one-time-token')
  @ApiOperation({
    summary: 'one time jwt token 재발급',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  @ResponseException(
    HttpStatus.FORBIDDEN,
    'Refresh token 만료 및 변조 -> 로그인 필요',
  )
  @ResponseData(GetOneTimeTokenReponse)
  async getOneTimeToken(
    @Request() req: any,
  ): Promise<ResponseDataDto<GetOneTimeTokenReponse>> {
    const oneTimeToken = await this.commonAuthService.generateJwt(
      { id: req.user.id },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );

    return new ResponseDataDto(
      plainToInstance(GetOneTimeTokenReponse, { oneTimeToken }),
    );
  }
}

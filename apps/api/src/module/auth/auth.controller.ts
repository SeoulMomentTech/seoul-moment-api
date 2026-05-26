import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  PostEmailCodeRequest,
  PostEmailVerifyRequest,
  PostPhoneVerifyRequest,
  PostRecaptchaRequest,
} from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/code')
  @ApiOperation({ summary: '이메일 인증 코드 발송' })
  @HttpCode(HttpStatus.OK)
  async postEmailCode(@Body() body: PostEmailCodeRequest) {
    await this.authService.sendEmailCode(body.email);
  }

  @Post('email/verify')
  @ApiOperation({ summary: '이메일 인증' })
  @HttpCode(HttpStatus.OK)
  async postEmailVerify(@Body() body: PostEmailVerifyRequest) {
    await this.authService.verifyEmail(body.email, parseInt(body.code, 10));
  }

  @Post('phone/verify')
  @ApiOperation({ summary: '휴대폰 인증' })
  @HttpCode(HttpStatus.OK)
  async postPhoneVerify(@Body() body: PostPhoneVerifyRequest) {
    await this.authService.verifyPhone(body.phone, parseInt(body.code, 10));
  }

  @Post('recaptcha')
  @ApiOperation({ summary: '리캡챠 인증' })
  @HttpCode(HttpStatus.OK)
  async postRecaptcha(@Body() body: PostRecaptchaRequest) {
    await this.authService.verifyRecaptcha(body.token);
  }
}

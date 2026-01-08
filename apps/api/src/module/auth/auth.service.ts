import { CommonAuthService } from '@app/auth/auth.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(private readonly authService: CommonAuthService) {}

  async sendEmailCode(email: string) {
    await this.authService.authEmail(email);
  }

  async verifyEmail(email: string, code: number) {
    await this.authService.verifyEmail(email, code);
  }

  async verifyRecaptcha(token: string) {
    await this.authService.verifyRecaptcha(token);
  }
}

import { CommonAuthModule } from '@app/auth/auth.module';
import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [CommonAuthModule.forRoot()],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsDefined, IsEmail, IsString } from 'class-validator';

export class PostPlanLoginRequest {
  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  @IsEmail()
  @IsDefined()
  email: string;

  @ApiProperty({
    description: '카카오 토큰',
    example: 'kakao_token',
  })
  @IsString()
  @IsDefined()
  kakaoToken: string;
}

export class PostPlanLoginResponse {
  @ApiProperty({
    description: 'JWT 토큰',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  })
  @IsString()
  @IsDefined()
  token: string;

  static from(token: string) {
    return plainToInstance(this, {
      token,
    });
  }
}

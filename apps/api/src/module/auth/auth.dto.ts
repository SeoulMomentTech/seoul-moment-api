import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsString } from 'class-validator';

export class PostEmailCodeRequest {
  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  @IsEmail()
  @IsDefined()
  email: string;
}

export class PostEmailVerifyRequest {
  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  @IsEmail()
  @IsDefined()
  email: string;

  @ApiProperty({
    description: '코드 (6자리)',
    example: '736294',
  })
  @IsString()
  @IsDefined()
  code: string;
}

export class PostRecaptchaRequest {
  @ApiProperty({
    description: '토큰',
    example: '03AFcWeA7W2...long-string...',
  })
  @IsString()
  @IsDefined()
  token: string;
}

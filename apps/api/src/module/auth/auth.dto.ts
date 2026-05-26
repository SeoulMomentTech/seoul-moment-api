import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsString, Matches } from 'class-validator';

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

export class PostPhoneVerifyRequest {
  @ApiProperty({
    description: '전화번호 (국제 코드 포함)',
    example: '821012345678',
  })
  @IsString()
  @IsDefined()
  phone: string;

  @ApiProperty({
    description: '코드 (6자리)',
    example: '736294',
  })
  @IsString()
  @IsDefined()
  @Matches(/^\d{6}$/)
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

import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsString } from 'class-validator';

export class PostAdminSignUpRequest {
  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  @IsEmail()
  @IsDefined()
  email: string;

  @ApiProperty({
    description: '비밀번호',
    example: 'password',
  })
  @IsString()
  @IsDefined()
  password: string;

  @ApiProperty({
    description: '이름',
    example: '이름',
  })
  @IsString()
  @IsDefined()
  name: string;
}

export class PostAdminLoginRequest {
  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  @IsEmail()
  @IsDefined()
  email: string;

  @ApiProperty({
    description: '비밀번호',
    example: 'password',
  })
  @IsString()
  @IsDefined()
  password: string;
}

export class PostAdminLoginResponse {
  @ApiProperty({
    description: '토큰',
    example: 'token',
  })
  @IsString()
  @IsDefined()
  token: string;

  @ApiProperty({
    description: '리프레시 토큰',
    example: 'refreshToken',
  })
  @IsString()
  @IsDefined()
  refreshToken: string;
}

export class GetOneTimeTokenReponse {
  @ApiProperty({
    description: 'one time token JWT',
    example: 'oneTimeToken',
  })
  @IsString()
  @IsDefined()
  oneTimeToken: string;
}

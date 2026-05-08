import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class PostUserSignUpRequest {
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
    description: '닉네임',
    example: 'nickname',
  })
  @IsString()
  @IsDefined()
  nickname: string;

  @ApiPropertyOptional({
    description: '신상품 및 기획전 출시 알림',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  newProductAgreed?: boolean;

  @ApiPropertyOptional({
    description: '광고 및 이벤트 할인 이메일',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  adAgreed?: boolean;

  @ApiPropertyOptional({
    description: '개인 맞춤 상품 추천 알림',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  recommendAgreed?: boolean;
}

export class PostNicknameValidateRequest {
  @ApiProperty({
    description: '닉네임',
    example: 'nickname',
  })
  @IsString()
  @IsDefined()
  nickname: string;
}

export class PostUserLoginRequest {
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

export class PostUserLoginResponse {
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

export class GetUserOneTimeTokenResponse {
  @ApiProperty({
    description: 'one time token JWT',
    example: 'oneTimeToken',
  })
  @IsString()
  @IsDefined()
  oneTimeToken: string;
}

export class PatchPasswordRequest {
  @ApiProperty({
    description: '비밀번호',
    example: 'password',
  })
  @IsString()
  @IsDefined()
  password: string;
}

export class PostUserPasswordEmailVerifyResponse {
  @ApiProperty({
    description: '비밀번호 재설정용 one time token JWT',
    example: 'oneTimeToken',
  })
  @IsString()
  @IsDefined()
  token: string;
}

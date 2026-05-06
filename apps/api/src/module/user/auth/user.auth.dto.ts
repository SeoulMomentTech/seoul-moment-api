import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
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

  @ApiPropertyOptional({
    description: '전화번호',
    example: '01012345678',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: '개인정보 수집 동의 일시',
    example: '2025-01-01 12:00:00',
  })
  @IsDateString()
  @IsDefined()
  personalInfoAgreeDate: string;

  @ApiPropertyOptional({
    description: '광고성 이메일 수신 동의 일시',
    example: '2025-01-01 12:00:00',
  })
  @IsDateString()
  @IsOptional()
  adAgreeEmailDate?: string;

  @ApiPropertyOptional({
    description: '추천 이메일 수신 동의 일시',
    example: '2025-01-01 12:00:00',
  })
  @IsDateString()
  @IsOptional()
  recommendEmailDate?: string;

  @ApiPropertyOptional({
    description: '추천 문자 수신 동의 일시',
    example: '2025-01-01 12:00:00',
  })
  @IsDateString()
  @IsOptional()
  recommendPhoneDate?: string;
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

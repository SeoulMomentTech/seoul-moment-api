import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';

export class KakaoValidateTokenResponse {
  id: number;
  expires_in: number;
  app_id: number;
}

// 1. 카카오 계정 정보 (내부 객체)
export class KakaoAccountDto {
  @ApiProperty({ description: '이메일 보유 여부', example: true })
  @IsBoolean()
  has_email: boolean;

  @ApiProperty({ description: '이메일 동의 필요 여부', example: false })
  @IsBoolean()
  email_needs_agreement: boolean;

  @ApiProperty({ description: '이메일 유효 여부', example: true })
  @IsBoolean()
  is_email_valid: boolean;

  @ApiProperty({ description: '이메일 인증 여부', example: true })
  @IsBoolean()
  is_email_verified: boolean;

  @ApiProperty({
    description: '카카오 이메일',
    example: 'example@kakao.com',
  })
  @IsString()
  email: string;
}

// 2. 메인 응답 객체
export class KakaoUserInfoResponseDto {
  @ApiProperty({
    description: '회원 번호 (Long -> Number)',
    example: 111111111111,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: '서비스 연결 시각 (UTC)',
    example: '2026-01-27T07:31:46Z',
  })
  @IsDateString()
  connected_at: string;

  @ApiProperty({ type: KakaoAccountDto, description: '카카오 계정 상세 정보' })
  @IsObject()
  @ValidateNested()
  @Type(() => KakaoAccountDto)
  kakao_account: KakaoAccountDto;
}

import { UserFitEntity } from '@app/repository/entity/user-fit.entity';
import { UserProfileEntity } from '@app/repository/entity/user-profile.entity';
import { UserEntity } from '@app/repository/entity/user.entity';
import { UserProfileGender } from '@app/repository/enum/user-profile.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class GetUserInfoResponse {
  @ApiPropertyOptional({
    description: '전화번호',
    example: '01012345678',
  })
  phone?: string;

  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  email: string;

  @ApiProperty({
    description: '광고성 이메일 수신 동의 여부',
    example: true,
  })
  adAgreeEmail: boolean;

  @ApiProperty({
    description: '추천 이메일 수신 동의 여부',
    example: true,
  })
  recommendEmail: boolean;

  @ApiProperty({
    description: '추천 문자 수신 동의 여부',
    example: true,
  })
  recommendPhone: boolean;

  @ApiProperty({
    description: '개인정보 수집 동의 여부',
    example: true,
  })
  personalInfoAgree: boolean;

  static from(entity: UserEntity) {
    return plainToInstance(this, {
      phone: entity.phone,
      email: entity.email,
      adAgreeEmail: entity.adAgreeEmailDate !== null,
      recommendEmail: entity.recommendEmailDate !== null,
      recommendPhone: entity.recommendPhoneDate !== null,
      personalInfoAgree: entity.personalInfoAgreeDate !== null,
    });
  }
}

export class PatchUserInfoRequest {
  @ApiPropertyOptional({
    description: '전화번호',
    example: '01012345678',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  @IsEmail()
  @IsDefined()
  email: string;

  @ApiProperty({
    description: '광고성 이메일 수신 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  adAgreeEmail: boolean;

  @ApiProperty({
    description: '추천 이메일 수신 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  recommendEmail: boolean;

  @ApiProperty({
    description: '추천 문자 수신 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  recommendPhone: boolean;

  @ApiProperty({
    description: '개인정보 수집 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  personalInfoAgree: boolean;
}

export class PostUserProfileRequest {
  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/image.png',
  })
  @IsString()
  @IsOptional()
  profileImageUrl?: string;

  @ApiPropertyOptional({
    description: '닉네임',
    example: '세리프',
  })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({
    description: '이름',
    example: '김서울',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '성별',
    example: 'MALE',
    enum: UserProfileGender,
  })
  @IsEnum(UserProfileGender)
  @IsDefined()
  gender: UserProfileGender;

  @ApiProperty({
    description: '생년월일 (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate는 YYYY-MM-DD 형식이어야 합니다.',
  })
  @IsDateString()
  @IsDefined()
  birthDate: string;

  @ApiProperty({
    description: '우편번호',
    example: '12345',
  })
  @IsString()
  @IsDefined()
  postalCode: string;

  @ApiProperty({
    description: '시/도',
    example: '서울',
  })
  @IsString()
  @IsDefined()
  city: string;

  @ApiProperty({
    description: '시/군/구',
    example: '강남구',
  })
  @IsString()
  @IsDefined()
  district: string;

  @ApiProperty({
    description: '상세 주소',
    example: '12345',
  })
  @IsString()
  @IsDefined()
  detailAddress: string;

  @ApiProperty({
    description: '프로필 공개 범위',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  visibility: boolean;
}

export class GetUserProfileResponse {
  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/image.png',
  })
  profileImageUrl?: string;

  @ApiPropertyOptional({
    description: '닉네임',
    example: '세리프',
  })
  nickname?: string;

  @ApiProperty({
    description: '이름',
    example: '김서울',
  })
  name: string;

  @ApiProperty({
    description: '성별',
    example: 'MALE',
    enum: UserProfileGender,
  })
  gender: UserProfileGender;

  @ApiProperty({
    description: '생년월일',
    example: '2025-01-01',
  })
  birthDate: string;

  @ApiProperty({
    description: '우편번호',
    example: '12345',
  })
  postalCode: string;

  @ApiProperty({
    description: '시/도',
    example: '서울',
  })
  city: string;

  @ApiProperty({
    description: '시/군/구',
    example: '강남구',
  })
  district: string;

  @ApiProperty({
    description: '상세 주소',
    example: '12345',
  })
  detailAddress: string;

  @ApiProperty({
    description: '프로필 공개 범위',
    example: true,
  })
  visibility: boolean;

  static from(entity: UserProfileEntity) {
    return plainToInstance(this, {
      profileImageUrl: entity.imagePath,
      nickname: entity.nickname,
      name: entity.name,
      gender: entity.gender,
      birthDate: entity.birthDate,
      postalCode: entity.postalCode,
      city: entity.city,
      district: entity.district,
      detailAddress: entity.detailAddress,
      visibility: entity.visibility,
    });
  }
}

export class PatchUserProfileRequest {
  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/image.png',
  })
  @IsString()
  @IsOptional()
  profileImageUrl?: string;

  @ApiPropertyOptional({
    description: '닉네임',
    example: '세리프',
  })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({
    description: '이름',
    example: '김서울',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '성별',
    example: 'MALE',
    enum: UserProfileGender,
  })
  @IsEnum(UserProfileGender)
  @IsDefined()
  gender: UserProfileGender;

  @ApiProperty({
    description: '생년월일 (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate는 YYYY-MM-DD 형식이어야 합니다.',
  })
  @IsDateString()
  @IsDefined()
  birthDate: string;

  @ApiProperty({
    description: '우편번호',
    example: '12345',
  })
  @IsString()
  @IsDefined()
  postalCode: string;

  @ApiProperty({
    description: '시/도',
    example: '서울',
  })
  @IsString()
  @IsDefined()
  city: string;

  @ApiProperty({
    description: '시/군/구',
    example: '강남구',
  })
  @IsString()
  @IsDefined()
  district: string;

  @ApiProperty({
    description: '상세 주소',
    example: '12345',
  })
  @IsString()
  @IsDefined()
  detailAddress: string;

  @ApiProperty({
    description: '프로필 공개 범위',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  visibility: boolean;
}

export class PostUserFitRequest {
  @ApiProperty({
    description: '키 (cm)',
    example: 180,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  height: number;

  @ApiProperty({
    description: '몸무게 (kg)',
    example: 70,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  weight: number;

  @ApiProperty({
    description: '신발 사이즈 (mm 단위, 예: 270)',
    example: 270,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  shoeSize: number;

  @ApiProperty({
    description: '아우터 사이즈 (예: S/M/L/XL, 95/100/105)',
    example: 'S',
  })
  @IsString()
  @IsDefined()
  outerSize: string;

  @ApiProperty({
    description: '상의 사이즈 (예: S/M/L/XL, 95/100/105)',
    example: 'S',
  })
  @IsString()
  @IsDefined()
  topSize: string;

  @ApiProperty({
    description: '하의 사이즈 (예: 28/30/32, S/M/L)',
    example: '28',
  })
  @IsString()
  @IsDefined()
  bottomSize: string;

  @ApiProperty({
    description: '민감정보(체형 데이터) 수집 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isSensitiveDataAgreed: boolean;
}

export class GetUserFitResponse {
  @ApiProperty({
    description: '키 (cm)',
    example: 180,
  })
  height: number;

  @ApiProperty({
    description: '몸무게 (kg)',
    example: 70,
  })
  weight: number;

  @ApiProperty({
    description: '신발 사이즈 (mm 단위, 예: 270)',
    example: 270,
  })
  shoeSize: number;

  @ApiProperty({
    description: '아우터 사이즈 (예: S/M/L/XL, 95/100/105)',
    example: 'S',
  })
  outerSize: string;

  @ApiProperty({
    description: '상의 사이즈 (예: S/M/L/XL, 95/100/105)',
    example: 'S',
  })
  topSize: string;

  @ApiProperty({
    description: '하의 사이즈 (예: 28/30/32, S/M/L)',
    example: '28',
  })
  bottomSize: string;

  @ApiProperty({
    description: '민감정보(체형 데이터) 수집 동의 여부',
    example: true,
  })
  isSensitiveDataAgreed: boolean;

  static from(entity: UserFitEntity) {
    return plainToInstance(this, {
      height: entity.height,
      weight: entity.weight,
      shoeSize: entity.shoeSize,
      outerSize: entity.outerSize,
      topSize: entity.topSize,
      bottomSize: entity.bottomSize,
      isSensitiveDataAgreed: entity.isSensitiveDataAgreed,
    });
  }
}

export class PatchUserFitRequest {
  @ApiProperty({
    description: '키 (cm)',
    example: 180,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  height: number;

  @ApiProperty({
    description: '몸무게 (kg)',
    example: 70,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  weight: number;

  @ApiProperty({
    description: '신발 사이즈 (mm 단위, 예: 270)',
    example: 270,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  shoeSize: number;

  @ApiProperty({
    description: '아우터 사이즈 (예: S/M/L/XL, 95/100/105)',
    example: 'S',
  })
  @IsString()
  @IsDefined()
  outerSize: string;

  @ApiProperty({
    description: '상의 사이즈 (예: S/M/L/XL, 95/100/105)',
    example: 'S',
  })
  @IsString()
  @IsDefined()
  topSize: string;

  @ApiProperty({
    description: '하의 사이즈 (예: 28/30/32, S/M/L)',
    example: '28',
  })
  @IsString()
  @IsDefined()
  bottomSize: string;

  @ApiProperty({
    description: '민감정보(체형 데이터) 수집 동의 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isSensitiveDataAgreed: boolean;
}

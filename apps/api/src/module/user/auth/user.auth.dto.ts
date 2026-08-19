import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

import { PostPhoneVerifyRequest as CommonPostPhoneVerifyRequest } from '../../auth/auth.dto';

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

  static from(token: string) {
    return plainToInstance(this, {
      token,
    });
  }
}

export class PostGoogleLoginRequest {
  @ApiProperty({
    description: 'Google Sign-In에서 발급받은 idToken',
    example: 'eyJhbGciOiJSUzI1Ni', // Google idToken JWT
  })
  @IsString()
  @IsDefined()
  idToken: string;
}

export class PostLineLoginRequest {
  @ApiProperty({
    description: 'LINE Login SDK/LIFF에서 발급받은 id_token',
    example: 'eyJhbGciOiJSUzI1Ni', // LINE id_token JWT
  })
  @IsString()
  @IsDefined()
  idToken: string;
}

/**
 * SNS 로그인(Google/LINE) 분기 응답 베이스.
 * Google/LINE의 응답 형태가 동일하여 공통 베이스로 둔다.
 */
export class PostSnsLoginResponse {
  @ApiProperty({
    description:
      'SNS 계정 연결 확인이 필요한지 여부. ' +
      'true면 email/linkToken이 내려가고, 클라이언트는 연결 확인 모달을 띄운 뒤 ' +
      '해당 provider의 link API를 호출해야 한다. ' +
      'false면 token/refreshToken이 내려가 바로 로그인 처리된다.',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  needsLinkConfirm: boolean;

  @ApiPropertyOptional({
    description:
      '연결 확인(needsLinkConfirm) 또는 신규 가입(needsSignup)이 필요한 경우, ' +
      'SNS 계정 이메일 (화면 표시용. 서버는 토큰에서 재검증한다)',
    example: 'test@test.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description:
      '연결 확인이 필요한 경우, 해당 provider의 link API에 전달할 단기 JWT',
    example: 'linkToken',
  })
  @IsString()
  @IsOptional()
  linkToken?: string;

  @ApiPropertyOptional({
    description:
      '가입된 이메일이 없어 SNS 회원가입이 필요한지 여부. ' +
      'true면 email/signupToken이 내려가고, 클라이언트는 닉네임/약관동의 ' +
      '입력 후 해당 provider의 signup API를 호출해야 한다.',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  needsSignup?: boolean;

  @ApiPropertyOptional({
    description:
      'SNS 회원가입이 필요한 경우, 해당 provider의 signup API에 전달할 단기 JWT',
    example: 'signupToken',
  })
  @IsString()
  @IsOptional()
  signupToken?: string;

  @ApiPropertyOptional({
    description:
      'SNS 회원가입이 필요한 경우 내려가는 SNS 표시 이름. ' +
      '닉네임 입력칸의 기본값으로 쓰라고 주는 값이며, 그대로 저장되지 않는다. ' +
      'provider가 이름을 주지 않으면(profile scope 미동의) 내려가지 않는다.',
    example: '홍길동',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: '이미 연결된 계정인 경우 발급되는 access token',
    example: 'token',
  })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({
    description: '이미 연결된 계정인 경우 발급되는 refresh token',
    example: 'refreshToken',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class PostGoogleLoginResponse extends PostSnsLoginResponse {}

export class PostLineLoginResponse extends PostSnsLoginResponse {}

export class PostGoogleLinkRequest {
  @ApiProperty({
    description: '/user/auth/google/login 응답으로 받은 단기 linkToken',
    example: 'linkToken',
  })
  @IsString()
  @IsDefined()
  linkToken: string;
}

export class PostLineLinkRequest {
  @ApiProperty({
    description: '/user/auth/line/login 응답으로 받은 단기 linkToken',
    example: 'linkToken',
  })
  @IsString()
  @IsDefined()
  linkToken: string;
}

/**
 * SNS 회원가입(Google/LINE) 요청 베이스.
 * signupToken + 닉네임 + 약관동의로 구성되며 provider별로 동일하다.
 */
export class PostSnsSignupRequest {
  @ApiProperty({
    description: 'SNS login 응답으로 받은 단기 signupToken',
    example: 'signupToken',
  })
  @IsString()
  @IsDefined()
  signupToken: string;

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

export class PostGoogleSignupRequest extends PostSnsSignupRequest {}

export class PostLineSignupRequest extends PostSnsSignupRequest {}

export class PostPhoneCodeRequest {
  @ApiProperty({
    description: '휴대폰 번호 (국제 코드 포함)',
    example: '821012345678',
  })
  @IsString()
  @IsDefined()
  phone: string;
}

export class PostSignupPhoneCodeRequest extends PostPhoneCodeRequest {}

export class PostSignupPhoneVerifyRequest extends CommonPostPhoneVerifyRequest {}

export class PostInfoPhoneCodeRequest extends PostPhoneCodeRequest {}

export class PostInfoPhoneVerifyRequest extends CommonPostPhoneVerifyRequest {}

export class PostPasswordPhoneCodeRequest extends PostPhoneCodeRequest {}

export class PostPasswordPhoneVerifyRequest extends CommonPostPhoneVerifyRequest {}

export class PostPasswordPhoneVerifyResponse {
  @ApiProperty({
    description: '비밀번호 재설정용 one time token JWT',
    example: 'oneTimeToken',
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

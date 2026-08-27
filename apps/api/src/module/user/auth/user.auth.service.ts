import { JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { RedisKey } from '@app/cache/cache.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { LoggerService } from '@app/common/log/logger.service';
import { stripImageDomain } from '@app/common/util/image.util';
import { Configuration } from '@app/config/configuration';
import { S3Service } from '@app/external/aws/s3/s3.service';
import { ExternalGoogleAuthService } from '@app/external/google/google-auth.service';
import { ExternalLineAuthService } from '@app/external/line/line-auth.service';
import { UpdateUserDto } from '@app/repository/dto/user.dto';
import { UserProfileImageEntity } from '@app/repository/entity/user-profile-image.entity';
import { UserProfileEntity } from '@app/repository/entity/user-profile.entity';
import { UserEntity } from '@app/repository/entity/user.entity';
import { UserSnsProvider } from '@app/repository/enum/user-sns.enum';
import { UserSnsRepositoryService } from '@app/repository/service/user-sns.repository.service';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { randomBytes } from 'crypto';
import { Transactional } from 'typeorm-transactional';

import {
  PostGoogleSignupRequest,
  PostLineEmailCodeRequest,
  PostLineEmailVerifyRequest,
  PostLineSignupRequest,
  PostPasswordPhoneVerifyResponse,
  PostSnsEmailCodeRequest,
  PostSnsEmailVerifyRequest,
  PostSnsLoginResponse,
  PostSnsSignupRequest,
  PostUserLoginRequest,
  PostUserLoginResponse,
  PostUserPasswordEmailVerifyResponse,
  PostUserSignUpRequest,
} from './user.auth.dto';
import { AuthService } from '../../auth/auth.service';

/** SNS idToken 검증 결과. name/picture 는 provider가 주지 않으면 null 이다. */
interface SnsLoginProfile {
  providerUserId: string;
  /** provider 가 이메일을 주지 않으면 null. 서비스가 직접 입력받는다. */
  email: string | null;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
}

@Injectable()
export class UserAuthService {
  constructor(
    private readonly userRepositoryService: UserRepositoryService,
    private readonly userSnsRepositoryService: UserSnsRepositoryService,
    private readonly commonAuthService: CommonAuthService,
    private readonly authService: AuthService,
    private readonly externalGoogleAuthService: ExternalGoogleAuthService,
    private readonly externalLineAuthService: ExternalLineAuthService,
    private readonly s3Service: S3Service,
    private readonly logger: LoggerService,
  ) {}

  async signUp(signUpRequest: PostUserSignUpRequest): Promise<void> {
    // email/code 에서 이미 걸러지지만, 가입 요청이 직접 들어오면 email 의
    // unique 제약에 걸려 500 이 난다. 같은 기준으로 여기서도 409 를 낸다.
    await this.assertEmailNotJoined(signUpRequest.email);

    await this.userRepositoryService.validateUserNickname(
      signUpRequest.nickname,
    );

    await this.userRepositoryService.createUser(
      plainToInstance(UserEntity, {
        email: signUpRequest.email,
        password: await bcrypt.hash(signUpRequest.password, 10),
        nickname: signUpRequest.nickname,
        newProductDate: signUpRequest.newProductAgreed ? new Date() : null,
        adAgreeDate: signUpRequest.adAgreed ? new Date() : null,
        recommendDate: signUpRequest.recommendAgreed ? new Date() : null,
      }),
    );
  }

  async login(
    loginRequest: PostUserLoginRequest,
  ): Promise<PostUserLoginResponse> {
    const user = await this.userRepositoryService.findUserByEmailWithPassword(
      loginRequest.email,
    );

    if (!user || !(await user.verifyPassword(loginRequest.password))) {
      throw new ServiceError(
        'Invalid credentials',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    return this.issueTokens(user.id);
  }

  async googleLogin(idToken: string): Promise<PostSnsLoginResponse> {
    const payload = await this.externalGoogleAuthService.verifyIdToken(idToken);

    return this.snsLogin(UserSnsProvider.GOOGLE, payload);
  }

  @Transactional()
  async googleLink(linkToken: string): Promise<PostUserLoginResponse> {
    return this.snsLink(UserSnsProvider.GOOGLE, linkToken);
  }

  async googleSignup(
    signupRequest: PostGoogleSignupRequest,
  ): Promise<PostUserLoginResponse> {
    return this.completeSnsSignup(UserSnsProvider.GOOGLE, signupRequest);
  }

  async lineLogin(idToken: string): Promise<PostSnsLoginResponse> {
    const payload = await this.externalLineAuthService.verifyIdToken(idToken);

    return this.snsLogin(UserSnsProvider.LINE, payload);
  }

  @Transactional()
  async lineLink(linkToken: string): Promise<PostUserLoginResponse> {
    return this.snsLink(UserSnsProvider.LINE, linkToken);
  }

  async lineSignup(
    signupRequest: PostLineSignupRequest,
  ): Promise<PostUserLoginResponse> {
    return this.completeSnsSignup(UserSnsProvider.LINE, signupRequest);
  }

  async lineEmailCode(request: PostLineEmailCodeRequest): Promise<void> {
    return this.snsEmailCode(UserSnsProvider.LINE, request);
  }

  async lineEmailVerify(
    request: PostLineEmailVerifyRequest,
  ): Promise<PostSnsLoginResponse> {
    return this.snsEmailVerify(UserSnsProvider.LINE, request);
  }

  /**
   * 미가입 SNS 계정에 내려줄 응답을 만든다.
   * name 은 닉네임 입력칸 기본값으로 쓰라고 화면에 내려주고,
   * picture 는 토큰에만 실어 둔다. 가입을 마치는 시점에 서버가 직접
   * 내려받아 S3로 옮기므로 클라이언트가 다룰 일이 없다.
   */
  /**
   * provider 가 이메일을 주지 않은 경우의 응답을 만든다.
   * 이 시점에는 어떤 계정에 이어질지 알 수 없으므로 가입/연결 분기를
   * 확정하지 않고, sub 만 담은 단기 토큰을 내려 이메일 인증을 먼저 받는다.
   */
  private async buildSnsEmailResponse(
    provider: UserSnsProvider,
    { providerUserId, name = null, picture = null }: SnsLoginProfile,
  ): Promise<PostSnsLoginResponse> {
    const emailToken = await this.issueSnsToken(
      { providerUserId, name, picture },
      JwtType.SNS_EMAIL_TOKEN,
      provider,
    );

    return {
      needsLinkConfirm: false,
      needsEmail: true,
      emailToken,
      ...(name ? { name } : {}),
    };
  }

  private async buildSnsSignupResponse(
    provider: UserSnsProvider,
    { providerUserId, email, name = null, picture = null }: SnsLoginProfile,
    providerEmail: string | null,
  ): Promise<PostSnsLoginResponse> {
    const signupToken = await this.issueSnsToken(
      { providerUserId, providerEmail, email, name, picture },
      JwtType.SNS_SIGNUP_TOKEN,
      provider,
    );

    return {
      needsLinkConfirm: false,
      needsSignup: true,
      email,
      signupToken,
      ...(name ? { name } : {}),
    };
  }

  /**
   * SNS 로그인 분기 코어. idToken 검증 결과를 받아
   * 연결됨 → 로그인 / 미가입 → signupToken / 가입됨·미연결 → linkToken 으로 분기한다.
   * 가입돼 있고 이미 다른 SNS 가 연결된 계정이면 409 로 끊는다(계정당 SNS 1개).
   */
  private async snsLogin(
    provider: UserSnsProvider,
    profile: SnsLoginProfile,
  ): Promise<PostSnsLoginResponse> {
    const { providerUserId, email, emailVerified } = profile;

    if (email && !emailVerified) {
      throw new ServiceError(
        'SNS 이메일이 인증되지 않았습니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    const linkedSns = await this.userSnsRepositoryService.findByProvider(
      provider,
      providerUserId,
    );

    if (linkedSns) {
      const tokens = await this.issueTokens(linkedSns.userId);

      return { needsLinkConfirm: false, ...tokens };
    }

    // provider 가 이메일을 주지 않았다면(사용자가 동의 화면에서 거부)
    // 여기서 막지 않고, 서비스가 직접 이메일을 입력받아 인증한다.
    if (!email) {
      return this.buildSnsEmailResponse(provider, profile);
    }

    if (!(await this.userRepositoryService.existUserByEmail(email))) {
      return this.buildSnsSignupResponse(provider, profile, email);
    }

    return this.buildSnsLinkResponse(provider, providerUserId, email, email);
  }

  /**
   * 기존 계정에 SNS 를 연결할 수 있는지 확인하고 linkToken 을 내려준다.
   * user 1 : sns 1 이므로 이미 다른 SNS 가 연결된 계정이면 연결 확인 단계로
   * 넘기지 않고 여기서 바로 409 로 끊는다.
   */
  private async buildSnsLinkResponse(
    provider: UserSnsProvider,
    providerUserId: string,
    email: string,
    providerEmail: string | null,
  ): Promise<PostSnsLoginResponse> {
    const user = await this.userRepositoryService.getUserByEmail(email);

    await this.assertSnsNotLinked(user.id);

    const linkToken = await this.issueSnsToken(
      { userId: user.id, providerUserId, providerEmail, email },
      JwtType.SNS_LINK_TOKEN,
      provider,
    );

    return { needsLinkConfirm: true, email, linkToken };
  }

  /**
   * user 1 : sns 1 규칙. 이미 SNS 가 연결된 회원에게는 다른 SNS 로그인/가입을
   * 허용하지 않는다. 구글로 가입한 회원이 같은 이메일의 LINE 으로 들어오면
   * 연결도 가입도 아닌 409 로 응답한다.
   */
  private async assertSnsNotLinked(userId: number): Promise<void> {
    const linkedSns = await this.userSnsRepositoryService.findByUserId(userId);

    if (linkedSns) {
      throw new ServiceError(
        `이미 ${linkedSns.provider} 계정이 연결된 회원입니다.`,
        ServiceErrorCode.CONFLICT,
      );
    }
  }

  /**
   * emailToken 을 검증해 SNS 계정 식별자를 꺼낸다.
   * provider 가 다르거나 타입이 맞지 않으면 다른 흐름의 토큰이므로 거부한다.
   */
  private async verifySnsEmailToken(
    provider: UserSnsProvider,
    emailToken: string,
  ): Promise<Record<string, any>> {
    const payload = await this.commonAuthService.verifyJwt(emailToken);

    if (
      payload.jwtType !== JwtType.SNS_EMAIL_TOKEN ||
      payload.provider !== provider
    ) {
      throw new ServiceError(
        '유효하지 않은 email token입니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    return payload;
  }

  /**
   * 사용자가 직접 입력한 이메일로 인증 코드를 보낸다.
   * 회원가입용 postEmailCode 와 달리 이미 가입된 이메일이어도 막지 않는다.
   * SNS 흐름에서 기존 계정에 연결하는 것은 정상 경로이고, 여기서 409 를
   * 내면 '그 이메일은 가입돼 있다'는 사실이 인증 없이 노출되기도 한다.
   */
  private async snsEmailCode(
    provider: UserSnsProvider,
    { emailToken, email }: PostSnsEmailCodeRequest,
  ): Promise<void> {
    await this.verifySnsEmailToken(provider, emailToken);

    await this.commonAuthService.authEmail(email);
  }

  /**
   * 입력한 이메일의 인증 코드를 검증한 뒤 가입/연결을 분기한다.
   *
   * 코드 검증이 이 흐름의 전부다. 검증 없이 이메일만 받아 분기하면
   * 남의 이메일을 입력해 그 계정에 자기 SNS 를 연결할 수 있다(계정 탈취).
   * 그래서 signupToken/linkToken 은 반드시 검증을 통과한 뒤에만 발급한다.
   */
  private async snsEmailVerify(
    provider: UserSnsProvider,
    { emailToken, email, code }: PostSnsEmailVerifyRequest,
  ): Promise<PostSnsLoginResponse> {
    const payload = await this.verifySnsEmailToken(provider, emailToken);

    await this.commonAuthService.verifyEmail(email, parseInt(code, 10));

    // 인증된 이메일로 기존 분기를 그대로 태운다. providerEmail 은 provider 가
    // 준 값이 아니므로 null 로 두고, user.email 로 쓸 값만 email 에 담는다.
    const profile: SnsLoginProfile = {
      providerUserId: payload.providerUserId,
      email,
      emailVerified: true,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };

    // providerEmail 은 provider 가 준 이메일을 담는 자리다. 여기서는 사용자가
    // 직접 입력한 값이므로 null 로 둔다. 섞으면 나중에 provider 가 실제로
    // 준 이메일과 구분할 수 없다.
    if (!(await this.userRepositoryService.existUserByEmail(email))) {
      return this.buildSnsSignupResponse(provider, profile, null);
    }

    return this.buildSnsLinkResponse(
      provider,
      profile.providerUserId,
      email,
      null,
    );
  }

  /** SNS 계정 연결 코어. linkToken을 검증해 user_sns 행을 추가하고 토큰을 발급한다. */
  private async snsLink(
    provider: UserSnsProvider,
    linkToken: string,
  ): Promise<PostUserLoginResponse> {
    const payload = await this.commonAuthService.verifyJwt(linkToken);

    if (
      payload.jwtType !== JwtType.SNS_LINK_TOKEN ||
      payload.provider !== provider
    ) {
      throw new ServiceError(
        '유효하지 않은 link token입니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    const { userId, providerUserId, providerEmail } = payload;
    await this.linkSnsAccount(provider, userId, providerUserId, providerEmail);

    return this.issueTokens(userId);
  }

  /**
   * 중복 연결을 검사한 뒤 user_sns 행을 생성한다. 이미 동일 연결이 있으면 무시한다.
   * 로그인 단계에서 이미 걸러지지만, 그 사이에 다른 SNS 가 연결됐을 수 있으므로
   * 발급된 linkToken 을 믿지 않고 연결 직전에 한 번 더 확인한다.
   */
  private async linkSnsAccount(
    provider: UserSnsProvider,
    userId: number,
    providerUserId: string,
    providerEmail: string | null,
  ): Promise<void> {
    const existing = await this.userSnsRepositoryService.findByProvider(
      provider,
      providerUserId,
    );

    if (existing && existing.userId !== userId) {
      throw new ServiceError(
        '이미 다른 계정에 연결된 SNS 계정입니다.',
        ServiceErrorCode.CONFLICT,
      );
    }

    if (existing) return;

    await this.assertSnsNotLinked(userId);

    await this.userSnsRepositoryService.createUserSns({
      userId,
      provider,
      providerUserId,
      providerEmail,
    });
  }

  /** SNS 회원가입 코어. signupToken을 검증해 신규 user + user_sns를 생성하고 토큰을 발급한다. */
  @Transactional()
  private async snsSignup(
    provider: UserSnsProvider,
    signupRequest: PostSnsSignupRequest,
  ): Promise<{
    tokens: PostUserLoginResponse;
    userId: number;
    picture: string | null;
  }> {
    const payload = await this.commonAuthService.verifyJwt(
      signupRequest.signupToken,
    );

    if (
      payload.jwtType !== JwtType.SNS_SIGNUP_TOKEN ||
      payload.provider !== provider
    ) {
      throw new ServiceError(
        '유효하지 않은 signup token입니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    const user = await this.createSnsUser(signupRequest, payload);

    await this.userSnsRepositoryService.createUserSns({
      userId: user.id,
      provider,
      providerUserId: payload.providerUserId,
      providerEmail: payload.providerEmail,
    });

    const tokens = await this.issueTokens(user.id);

    return { tokens, userId: user.id, picture: payload.picture ?? null };
  }

  /**
   * SNS 회원가입 전체 흐름. 계정 생성은 트랜잭션 안에서 끝내고,
   * 프로필 이미지 이관은 커밋 뒤에 별도로 처리한다. 외부 이미지를 받아
   * S3에 올리는 네트워크 작업을 트랜잭션 안에 두면 커넥션을 그만큼
   * 붙잡게 되고, 이미지 실패가 가입 실패로 번진다.
   */
  private async completeSnsSignup(
    provider: UserSnsProvider,
    signupRequest: PostSnsSignupRequest,
  ): Promise<PostUserLoginResponse> {
    const { tokens, userId, picture } = await this.snsSignup(
      provider,
      signupRequest,
    );

    await this.migrateSnsProfileImage(userId, picture);

    return tokens;
  }

  /**
   * SNS 프로필 이미지를 우리 S3로 옮겨 붙인다.
   * provider가 준 URL을 그대로 저장하지 않는 이유는 두 가지다.
   * imagePath 는 IMAGE_DOMAIN_NAME 을 앞에 붙여 쓰는 상대 경로 전제라
   * 외부 URL을 넣으면 주소가 깨지고, provider의 이미지 URL은 사용자가
   * 사진을 바꾸면 만료된다.
   * 실패해도 가입은 유효하므로 경고만 남기고 넘어간다.
   */
  private async migrateSnsProfileImage(
    userId: number,
    picture: string | null,
  ): Promise<void> {
    if (!picture) return;

    try {
      const response = await fetch(picture);

      if (!response.ok) {
        throw new Error(`이미지 응답 코드 ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const { url } = await this.s3Service.uploadImage(buffer, {
        folder: 'profile',
      });

      // user_profile_image 는 user_profile 을 참조하므로 빈 프로필을 먼저 만든다.
      if (!(await this.userRepositoryService.findUserProfile(userId))) {
        await this.userRepositoryService.createUserProfile(
          plainToInstance(UserProfileEntity, { userId }),
        );
      }

      await this.userRepositoryService.createUserProfileImage(
        plainToInstance(UserProfileImageEntity, {
          userId,
          imagePath: stripImageDomain(url),
        }),
      );
    } catch (error) {
      this.logger.warn('SNS 프로필 이미지 이관 실패', {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * 회원가입용 이메일 인증 코드를 보낸다.
   * 이미 가입된 이메일이면 코드를 보내지 않고 409 로 끊되, SNS 로 가입한
   * 계정은 SNS_JOINED 로 구분해 준다. 그 계정은 비밀번호가 사용 불가한
   * 임의값이라, 그냥 '이미 가입된 이메일' 로만 안내하면 사용자가 이메일
   * 로그인을 시도하다 막다른 길에 빠진다.
   */
  async postEmailCode(email: string): Promise<void> {
    await this.assertEmailNotJoined(email);

    await this.authService.sendEmailCode(email);
  }

  /** 가입 여부를 확인하고, 가입돼 있으면 SNS 연동 여부로 갈라 409 를 던진다. */
  private async assertEmailNotJoined(email: string): Promise<void> {
    if (!(await this.userRepositoryService.existUserByEmail(email))) return;

    const user = await this.userRepositoryService.getUserByEmail(email);
    const linkedSns = await this.userSnsRepositoryService.findByUserId(user.id);

    if (linkedSns) {
      throw new ServiceError(
        'SNS로 가입된 이메일입니다.',
        ServiceErrorCode.SNS_JOINED,
      );
    }

    throw new ServiceError('User already exists', ServiceErrorCode.CONFLICT);
  }

  async postPasswordEmailCode(email: string): Promise<void> {
    const exist = await this.userRepositoryService.existUserByEmail(email);

    if (!exist) {
      throw new ServiceError('User not found', ServiceErrorCode.NOT_FOUND_DATA);
    }

    await this.authService.sendEmailCode(email);
  }

  async postPasswordEmailVerify(
    email: string,
    code: number,
  ): Promise<PostUserPasswordEmailVerifyResponse> {
    await this.authService.verifyEmail(email, code);

    const user = await this.userRepositoryService.getUserByEmail(email);

    const token = await this.commonAuthService.generateJwt(
      { id: user.id },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );

    return PostUserPasswordEmailVerifyResponse.from(token);
  }

  async patchPassword(userId: number, password: string): Promise<void> {
    await this.userRepositoryService.updateUser({
      id: userId,
      password: await bcrypt.hash(password, 10),
    });
  }

  async validateUserNickname(nickname: string): Promise<void> {
    await this.userRepositoryService.validateUserNickname(nickname);
  }

  async sendSignupPhoneCode(phone: string): Promise<void> {
    const exist = await this.userRepositoryService.existUserByPhone(phone);

    if (exist) {
      throw new ServiceError('User already exists', ServiceErrorCode.CONFLICT);
    }

    await this.commonAuthService.authPhone(RedisKey.SIGNUP_PHONE, phone);
  }

  async verifySignupPhone(phone: string, code: number): Promise<void> {
    await this.commonAuthService.verifyPhone(
      phone,
      code,
      RedisKey.SIGNUP_PHONE,
    );
  }

  async sendInfoPhoneCode(phone: string): Promise<void> {
    const exist = await this.userRepositoryService.existUserByPhone(phone);

    if (exist) {
      throw new ServiceError('User already exists', ServiceErrorCode.CONFLICT);
    }

    await this.commonAuthService.authPhone(RedisKey.INFO_PHONE, phone);
  }

  async verifyInfoPhone(
    phone: string,
    code: number,
    id: number,
  ): Promise<void> {
    await this.commonAuthService.verifyPhone(phone, code, RedisKey.INFO_PHONE);

    await this.userRepositoryService.updateUser({
      id,
      phone,
    });
  }

  async sendPasswordPhoneCode(phone: string): Promise<void> {
    const exist = await this.userRepositoryService.existUserByPhone(phone);

    if (!exist) {
      throw new ServiceError('User not found', ServiceErrorCode.NOT_FOUND_DATA);
    }

    await this.commonAuthService.authPhone(RedisKey.PASSWORD_PHONE, phone);
  }

  async verifyPasswordPhone(
    phone: string,
    code: number,
  ): Promise<PostPasswordPhoneVerifyResponse> {
    await this.commonAuthService.verifyPhone(
      phone,
      code,
      RedisKey.PASSWORD_PHONE,
    );

    const user = await this.userRepositoryService.getUserByPhone(phone);

    const token = await this.commonAuthService.generateJwt(
      { id: user.id },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );

    return PostPasswordPhoneVerifyResponse.from(token);
  }

  private async createSnsUser(
    signupRequest: PostSnsSignupRequest,
    payload: Record<string, any>,
  ): Promise<UserEntity> {
    await this.userRepositoryService.validateUserNickname(
      signupRequest.nickname,
    );

    if (await this.userRepositoryService.existUserByEmail(payload.email)) {
      throw new ServiceError(
        '이미 가입된 이메일입니다.',
        ServiceErrorCode.CONFLICT,
      );
    }

    return this.userRepositoryService.createUser(
      plainToInstance(UserEntity, {
        email: payload.email,
        // SNS 가입자는 비밀번호가 없으므로 사용 불가한 임의값으로 채운다
        password: await bcrypt.hash(randomBytes(48).toString('hex'), 10),
        nickname: signupRequest.nickname,
        newProductDate: signupRequest.newProductAgreed ? new Date() : null,
        adAgreeDate: signupRequest.adAgreed ? new Date() : null,
        recommendDate: signupRequest.recommendAgreed ? new Date() : null,
      }),
    );
  }

  private async issueSnsToken(
    payload: Record<string, any>,
    jwtType: JwtType,
    provider: UserSnsProvider,
  ): Promise<string> {
    const expiresIn = jwtType === JwtType.SNS_SIGNUP_TOKEN ? '10m' : '5m';

    return this.commonAuthService.generateJwt(
      { ...payload, provider },
      jwtType,
      expiresIn,
    );
  }

  private async issueTokens(userId: number): Promise<PostUserLoginResponse> {
    const accessToken = await this.commonAuthService.generateJwt(
      { id: userId },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );
    const refreshToken = await this.commonAuthService.generateJwt(
      { id: userId },
      JwtType.REFRESH_TOKEN,
      '14d',
    );

    const updateDto: UpdateUserDto = {
      id: userId,
      refreshToken,
    };

    await this.userRepositoryService.updateUser(updateDto);

    return { token: accessToken, refreshToken };
  }
}

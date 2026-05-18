import { JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { ExternalGoogleAuthService } from '@app/external/google/google-auth.service';
import { UpdateUserDto } from '@app/repository/dto/user.dto';
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
  PostGoogleLoginResponse,
  PostGoogleSignupRequest,
  PostUserLoginRequest,
  PostUserLoginResponse,
  PostUserSignUpRequest,
} from './user.auth.dto';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly userRepositoryService: UserRepositoryService,
    private readonly userSnsRepositoryService: UserSnsRepositoryService,
    private readonly commonAuthService: CommonAuthService,
    private readonly authService: AuthService,
    private readonly externalGoogleAuthService: ExternalGoogleAuthService,
  ) {}

  async signUp(signUpRequest: PostUserSignUpRequest): Promise<void> {
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

  async googleLogin(idToken: string): Promise<PostGoogleLoginResponse> {
    const { providerUserId, email, emailVerified } =
      await this.externalGoogleAuthService.verifyIdToken(idToken);

    if (!emailVerified) {
      throw new ServiceError(
        'Google 이메일이 인증되지 않았습니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    const linkedSns = await this.userSnsRepositoryService.findByProvider(
      UserSnsProvider.GOOGLE,
      providerUserId,
    );

    if (linkedSns) {
      const tokens = await this.issueTokens(linkedSns.userId);

      return { needsLinkConfirm: false, ...tokens };
    }

    if (!(await this.userRepositoryService.existUserByEmail(email))) {
      const signupToken = await this.issueSnsToken(
        { providerUserId, providerEmail: email, email },
        JwtType.SNS_SIGNUP_TOKEN,
      );

      return { needsLinkConfirm: false, needsSignup: true, email, signupToken };
    }

    const user = await this.userRepositoryService.getUserByEmail(email);
    const linkToken = await this.issueSnsToken(
      { userId: user.id, providerUserId, providerEmail: email, email },
      JwtType.SNS_LINK_TOKEN,
    );

    return { needsLinkConfirm: true, email, linkToken };
  }

  @Transactional()
  async googleLink(linkToken: string): Promise<PostUserLoginResponse> {
    const payload = await this.commonAuthService.verifyJwt(linkToken);

    if (payload.jwtType !== JwtType.SNS_LINK_TOKEN) {
      throw new ServiceError(
        '유효하지 않은 link token입니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    const { userId, providerUserId, providerEmail } = payload;

    const existing = await this.userSnsRepositoryService.findByProvider(
      UserSnsProvider.GOOGLE,
      providerUserId,
    );

    if (existing && existing.userId !== userId) {
      throw new ServiceError(
        '이미 다른 계정에 연결된 Google 계정입니다.',
        ServiceErrorCode.CONFLICT,
      );
    }

    if (!existing) {
      const userGoogleSns =
        await this.userSnsRepositoryService.findByUserAndProvider(
          userId,
          UserSnsProvider.GOOGLE,
        );

      if (userGoogleSns) {
        throw new ServiceError(
          '이미 다른 Google 계정이 연결된 계정입니다.',
          ServiceErrorCode.CONFLICT,
        );
      }

      await this.userSnsRepositoryService.createUserSns({
        userId,
        provider: UserSnsProvider.GOOGLE,
        providerUserId,
        providerEmail,
      });
    }

    return this.issueTokens(userId);
  }

  @Transactional()
  async googleSignup(
    signupRequest: PostGoogleSignupRequest,
  ): Promise<PostUserLoginResponse> {
    const payload = await this.commonAuthService.verifyJwt(
      signupRequest.signupToken,
    );

    if (payload.jwtType !== JwtType.SNS_SIGNUP_TOKEN) {
      throw new ServiceError(
        '유효하지 않은 signup token입니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    const user = await this.createSnsUser(signupRequest, payload);

    await this.userSnsRepositoryService.createUserSns({
      userId: user.id,
      provider: UserSnsProvider.GOOGLE,
      providerUserId: payload.providerUserId,
      providerEmail: payload.providerEmail,
    });

    return this.issueTokens(user.id);
  }

  async postEmailCode(email: string): Promise<void> {
    const exist = await this.userRepositoryService.existUserByEmail(email);

    if (exist) {
      throw new ServiceError('User already exists', ServiceErrorCode.CONFLICT);
    }

    await this.authService.sendEmailCode(email);
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
  ): Promise<{ token: string }> {
    await this.authService.verifyEmail(email, code);

    const user = await this.userRepositoryService.getUserByEmail(email);

    const token = await this.commonAuthService.generateJwt(
      { id: user.id },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );

    return { token };
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

  private async createSnsUser(
    signupRequest: PostGoogleSignupRequest,
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
  ): Promise<string> {
    const expiresIn = jwtType === JwtType.SNS_SIGNUP_TOKEN ? '10m' : '5m';

    return this.commonAuthService.generateJwt(
      { ...payload, provider: UserSnsProvider.GOOGLE },
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

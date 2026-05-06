import { JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { UpdateUserDto } from '@app/repository/dto/user.dto';
import { UserEntity } from '@app/repository/entity/user.entity';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';

import {
  PostUserLoginRequest,
  PostUserLoginResponse,
  PostUserSignUpRequest,
} from './user.auth.dto';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly userRepositoryService: UserRepositoryService,
    private readonly commonAuthService: CommonAuthService,
    private readonly authService: AuthService,
  ) {}

  async signUp(signUpRequest: PostUserSignUpRequest): Promise<void> {
    await this.userRepositoryService.createUser(
      plainToInstance(UserEntity, {
        email: signUpRequest.email,
        password: await bcrypt.hash(signUpRequest.password, 10),
        phone: signUpRequest.phone,
        personalInfoAgreeDate: new Date(signUpRequest.personalInfoAgreeDate),
        adAgreeEmailDate: signUpRequest.adAgreeEmailDate
          ? new Date(signUpRequest.adAgreeEmailDate)
          : null,
        recommendEmailDate: signUpRequest.recommendEmailDate
          ? new Date(signUpRequest.recommendEmailDate)
          : null,
        recommendPhoneDate: signUpRequest.recommendPhoneDate
          ? new Date(signUpRequest.recommendPhoneDate)
          : null,
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

    const accessToken = await this.commonAuthService.generateJwt(
      { id: user.id },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );
    const refreshToken = await this.commonAuthService.generateJwt(
      { id: user.id },
      JwtType.REFRESH_TOKEN,
      '14d',
    );

    const updateDto: UpdateUserDto = {
      id: user.id,
      refreshToken,
    };

    await this.userRepositoryService.updateUser(updateDto);

    return { token: accessToken, refreshToken };
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
}

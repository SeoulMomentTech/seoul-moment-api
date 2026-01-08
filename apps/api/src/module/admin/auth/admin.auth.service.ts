import { JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { Configuration } from '@app/config/configuration';
import { UpdateAdminDto } from '@app/repository/dto/admin.dto';
import { AdminEntity } from '@app/repository/entity/admin.entity';
import { AdminRepositoryService } from '@app/repository/service/admin.repository.service';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

import {
  PostAdminLoginRequest,
  PostAdminLoginResponse,
  PostAdminSignUpRequest,
} from './admin.auth.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly commonAuthService: CommonAuthService,
    private readonly adminRepositoryService: AdminRepositoryService,
  ) {}

  async signUp(signUpRequest: PostAdminSignUpRequest) {
    const admin = AdminEntity.from(
      signUpRequest.email,
      await bcrypt.hash(signUpRequest.password, 10),
      signUpRequest.name,
    );

    await this.adminRepositoryService.createAdmin(admin);
  }

  async login(
    loginRequest: PostAdminLoginRequest,
  ): Promise<PostAdminLoginResponse> {
    const admin = await this.adminRepositoryService.getAdminByEmail(
      loginRequest.email,
    );

    await admin.verifyPassword(loginRequest.password);

    const accessToken = await this.commonAuthService.generateJwt(
      { adminId: admin.id },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );
    const refreshToken = await this.commonAuthService.generateJwt(
      { adminId: admin.id },
      JwtType.REFRESH_TOKEN,
      '14d',
    );

    admin.refreshToken = refreshToken;

    const updateDto: UpdateAdminDto = {
      id: admin.id,
      refreshToken,
    };

    await this.adminRepositoryService.updateAdmin(updateDto);

    return { token: accessToken, refreshToken };
  }
}

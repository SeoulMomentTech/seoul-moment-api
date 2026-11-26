import { JwtAudience, JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
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
    // 같은 메일이 두 줄이면 한 줄만 승인돼 로그인이 다른 줄(WAIT)에 걸릴 수 있다
    if (
      await this.adminRepositoryService.existsAdminByEmail(signUpRequest.email)
    ) {
      throw new ServiceError(
        'Already registered admin email',
        ServiceErrorCode.CONFLICT,
      );
    }

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
    // 비밀번호가 맞은 뒤에 본다 — 남의 계정 상태를 메일만으로 알아낼 수 없게
    admin.verifyApproved();

    const accessToken = await this.commonAuthService.generateJwt(
      { id: admin.id, aud: JwtAudience.ADMIN },
      JwtType.ONE_TIME_TOKEN,
      Configuration.getConfig().JWT_EXPIRES_IN,
    );
    const refreshToken = await this.commonAuthService.generateJwt(
      { id: admin.id, aud: JwtAudience.ADMIN },
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

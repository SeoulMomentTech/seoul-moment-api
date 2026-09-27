import { JwtType } from '@app/auth/auth.dto';
import { getTokenSubjectId, isAdminToken } from '@app/auth/auth.token';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { AdminStatus } from '@app/repository/enum/admin.enum';
import { AdminRepositoryService } from '@app/repository/service/admin.repository.service';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { ExtractJwt } from 'passport-jwt';

import { ADMIN_ROLE_KEY } from '../decorator/admin-role.decorator';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(
    @Inject()
    private readonly adminRepositoryService: AdminRepositoryService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<string>(
      ADMIN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const payload = this.verifyJwtToken(context);

    // 역할이 지정되지 않았으면 통과
    if (!requiredRole) {
      return true;
    }

    await this.validateRole(payload, requiredRole);

    return true;
  }

  private verifyJwtToken(context: ExecutionContext): Record<string, any> {
    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    if (!token) {
      throw new ServiceError('Token not found', ServiceErrorCode.UNAUTHORIZED);
    }

    // JWT payload 디코딩 (만료 시간 자동 검증)
    let payload: Record<string, any>;
    try {
      payload = jwt.verify(
        token,
        Configuration.getConfig().JWT_SECRET,
      ) as Record<string, any>;
    } catch (error) {
      throw new ServiceError(
        error instanceof jwt.TokenExpiredError
          ? 'Token expired'
          : 'Invalid token',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    // JWT 타입 검증 (ONE_TIME_TOKEN인지 확인)
    if (payload.jwtType !== JwtType.ONE_TIME_TOKEN) {
      throw new ServiceError(
        'Invalid token type',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    // 회원 토큰도 같은 시크릿·jwtType 이라 aud 로 관리자 토큰만 가려낸다
    if (!isAdminToken(payload) || getTokenSubjectId(payload) === null) {
      throw new ServiceError(
        'Not an admin token',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    return payload;
  }

  private async validateRole(
    payload: Record<string, any>,
    requiredRole: string,
  ) {
    const adminEntity = await this.adminRepositoryService.findAdminById(
      getTokenSubjectId(payload),
      AdminStatus.NORMAL,
    );

    if (!adminEntity || !adminEntity.role) {
      throw new ServiceError(
        'Admin not found or not in normal status',
        ServiceErrorCode.FORBIDDEN,
      );
    }

    if (adminEntity.role.name !== requiredRole) {
      throw new ServiceError(
        'Insufficient permissions',
        ServiceErrorCode.FORBIDDEN,
      );
    }
  }
}

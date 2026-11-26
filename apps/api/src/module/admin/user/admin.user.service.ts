import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { AdminRoleRepositoryService } from '@app/repository/service/admin-role.repository.service';
import { AdminRepositoryService } from '@app/repository/service/admin.repository.service';
import { Injectable } from '@nestjs/common';

import {
  AdminUserRequest,
  AdminUserResponse,
  PatchAdminUserRequest,
} from './admin.user.dto';

@Injectable()
export class AdminUserService {
  constructor(
    private readonly adminRepositoryService: AdminRepositoryService,
    private readonly adminRoleRepositoryService: AdminRoleRepositoryService,
  ) {}

  /** 역할·상태를 바꾼다. 가드가 매 요청마다 DB 를 보므로 다음 요청부터 바로 적용된다 */
  async update(
    actorId: number,
    id: number,
    dto: PatchAdminUserRequest,
  ): Promise<AdminUserResponse> {
    if (dto.role === undefined && dto.status === undefined) {
      throw new ServiceError('Nothing to update', ServiceErrorCode.BAD_REQUEST);
    }

    // 마지막 super_admin 이 스스로 권한을 내려 아무도 권한을 못 주게 되는 것을 막는다
    if (actorId === id) {
      throw new ServiceError(
        'You cannot change your own role or status',
        ServiceErrorCode.CONFLICT,
      );
    }

    await this.adminRepositoryService.getAdminById(id);

    const role = dto.role
      ? await this.adminRoleRepositoryService.findByName(dto.role)
      : null;

    // admin_role 시드가 다른 DB 면 조용히 200 이 나가지 않게 한다
    if (dto.role && !role) {
      throw new ServiceError(
        `No exist admin role: ${dto.role}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    await this.adminRepositoryService.updateAdmin({
      id,
      ...(role && { roleId: role.id }),
      ...(dto.status && { status: dto.status }),
    });

    return AdminUserResponse.from(
      await this.adminRepositoryService.getAdminById(id),
    );
  }

  async getAdminUserList(
    dto: AdminUserRequest,
  ): Promise<[AdminUserResponse[], number]> {
    const [adminUserEntities, total] =
      await this.adminRepositoryService.getList(
        dto.page,
        dto.count,
        dto.search,
        dto.sort,
      );

    return [
      adminUserEntities.map((entity) => AdminUserResponse.from(entity)),
      total,
    ];
  }
}

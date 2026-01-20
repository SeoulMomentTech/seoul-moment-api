import { AdminRepositoryService } from '@app/repository/service/admin.repository.service';
import { Injectable } from '@nestjs/common';

import { AdminUserRequest, AdminUserResponse } from './admin.user.dto';

@Injectable()
export class AdminUserService {
  constructor(
    private readonly adminRepositoryService: AdminRepositoryService,
  ) {}

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

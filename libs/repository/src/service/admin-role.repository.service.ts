import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AdminRoleEntity } from '../entity/admin-role.entity';

@Injectable()
export class AdminRoleRepositoryService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminRoleEntity)
    private readonly adminRoleRepository: Repository<AdminRoleEntity>,
  ) {}

  async onModuleInit() {
    const count = await this.adminRoleRepository.count();
    if (count === 0) {
      await this.adminRoleRepository.save([
        {
          name: 'super_admin',
        },
        {
          name: 'admin',
        },
      ]);
    }
  }
}

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UpdateAdminDto } from '../dto/admin.dto';
import { AdminEntity } from '../entity/admin.entity';

@Injectable()
export class AdminRepositoryService {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
  ) {}

  async createAdmin(admin: AdminEntity): Promise<AdminEntity> {
    return this.adminRepository.save(admin);
  }

  async getAdminByEmail(email: string): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({ where: { email } });

    if (!admin) {
      throw new ServiceError(
        'Admin not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return admin;
  }

  async getAdminById(id: number): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({ where: { id } });

    if (!admin) {
      throw new ServiceError(
        'Admin not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return admin;
  }

  async updateAdmin(updateDto: UpdateAdminDto): Promise<AdminEntity> {
    return this.adminRepository.save(updateDto);
  }
}

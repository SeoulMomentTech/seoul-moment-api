import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';

import { UpdateAdminDto } from '../dto/admin.dto';
import { AdminEntity } from '../entity/admin.entity';
import { AdminStatus } from '../enum/admin.enum';

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
    const admin = await this.adminRepository.findOne({
      where: { email },
      relations: ['role'],
    });

    if (!admin) {
      throw new ServiceError(
        'Admin not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return admin;
  }

  async getAdminById(id: number): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({
      where: { id },
      relations: ['role'],
    });

    if (!admin) {
      throw new ServiceError(
        'Admin not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return admin;
  }

  async findAdminById(id: number, status?: AdminStatus): Promise<AdminEntity> {
    return this.adminRepository.findOne({
      where: { id, status },
      relations: ['role'],
    });
  }

  async updateAdmin(updateDto: UpdateAdminDto): Promise<AdminEntity> {
    return this.adminRepository.save(updateDto);
  }

  async getList(
    page: number,
    count: number,
    search?: string,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[AdminEntity[], number]> {
    const findOptions: FindOptionsWhere<AdminEntity> = {};

    if (search) {
      findOptions.email = Like(`%${search}%`);
    }

    return this.adminRepository.findAndCount({
      skip: (page - 1) * count,
      take: count,
      order: {
        createDate: sort,
      },
      where: findOptions,
      relations: ['role'],
    });
  }
}

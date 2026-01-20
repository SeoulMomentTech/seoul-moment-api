import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AdminRoleEntity } from './admin-role.entity';
import { CommonEntity } from './common.entity';
import { AdminStatus } from '../enum/admin.enum';

@Entity('admin')
export class AdminEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'role_id', nullable: true })
  roleId: number;

  @Column('varchar', { length: 255, nullable: false })
  email: string;

  @Column('varchar', { length: 255, nullable: false })
  password: string;

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @Column('varchar', { length: 255, nullable: true })
  refreshToken: string;

  @ManyToOne(() => AdminRoleEntity, (role) => role.admins)
  @JoinColumn({ name: 'role_id' })
  role: AdminRoleEntity;

  @Column('enum', {
    enum: AdminStatus,
    default: AdminStatus.WAIT,
    nullable: false,
  })
  status: AdminStatus;

  static from(
    email: string,
    password: string,
    name: string,
    status: AdminStatus = AdminStatus.WAIT,
    roleId: number = 2,
    refreshToken?: string,
  ): AdminEntity {
    return plainToInstance(this, {
      email,
      password,
      name,
      refreshToken,
      status,
      roleId,
    });
  }

  async verifyPassword(password: string) {
    const compare = await bcrypt.compare(password, this.password);

    if (!compare)
      throw new ServiceError(
        'Password does not match',
        ServiceErrorCode.UNAUTHORIZED,
      );
  }
}

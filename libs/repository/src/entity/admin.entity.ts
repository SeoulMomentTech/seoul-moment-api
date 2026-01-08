import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';

@Entity('admin')
export class AdminEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: false })
  email: string;

  @Column('varchar', { length: 255, nullable: false })
  password: string;

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @Column('varchar', { length: 255, nullable: true })
  refreshToken: string;

  static from(
    email: string,
    password: string,
    name: string,
    refreshToken?: string,
  ): AdminEntity {
    return plainToInstance(this, {
      email,
      password,
      name,
      refreshToken,
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

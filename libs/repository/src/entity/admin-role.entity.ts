import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { AdminEntity } from './admin.entity';
import { CommonEntity } from './common.entity';

@Entity('admin_role')
export class AdminRoleEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: false, unique: true })
  name: string;

  @OneToMany(() => AdminEntity, (admin) => admin.role)
  admins: AdminEntity[];
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';

@Entity('user')
export class UserEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: false, unique: true })
  email: string;

  @Column('varchar', { length: 255, nullable: false })
  password: string;

  @Column('varchar', { length: 255, nullable: false, unique: true })
  phone: string;

  @Column('timestamp', {
    nullable: true,
    default: () => "(NOW() AT TIME ZONE 'UTC')",
  })
  adAgreeEmailDate: Date;

  @Column('timestamp', {
    nullable: true,
    default: () => "(NOW() AT TIME ZONE 'UTC')",
  })
  recommendEmailDate: Date;

  @Column('timestamp', {
    nullable: true,
    default: () => "(NOW() AT TIME ZONE 'UTC')",
  })
  recommendPhoneDate: Date;
}

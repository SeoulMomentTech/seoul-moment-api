import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { UserProfileGender } from '../enum/user-profile.enum';

@Entity('user_profile')
export class UserProfileEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: false })
  imagePath: string;

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @Column('enum', {
    enum: UserProfileGender,
    default: UserProfileGender.OTHER,
    nullable: false,
  })
  gender: UserProfileGender;

  @Column('date', { nullable: false })
  birthDate: Date;

  @Column('varchar', { length: 255, nullable: false })
  postalCode: string;

  @Column('varchar', { length: 255, nullable: false })
  city: string;

  @Column('varchar', { length: 255, nullable: false })
  district: string;

  @Column('varchar', { length: 255, nullable: false })
  detailAddress: string;
}

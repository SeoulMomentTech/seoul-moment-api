import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { UserProfileImageEntity } from './user-profile-image.entity';
import { UserEntity } from './user.entity';
import { UserProfileGender } from '../enum/user-profile.enum';

@Entity('user_profile')
@Index(['city', 'district'])
export class UserProfileEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조)',
  })
  userId: number;

  @Column('varchar', { length: 255, nullable: true, comment: '이름' })
  name: string;

  @Column('enum', {
    enum: UserProfileGender,
    nullable: true,
    comment: '성별',
  })
  gender: UserProfileGender;

  @Column('date', { nullable: true, comment: '생년월일' })
  birthDate: string;

  @Column('varchar', { length: 255, nullable: true, comment: '우편번호' })
  postalCode: string;

  @Column('varchar', { length: 255, nullable: true, comment: '시/도' })
  city: string;

  @Column('varchar', { length: 255, nullable: true, comment: '시/군/구' })
  district: string;

  @Column('varchar', { length: 255, nullable: true, comment: '상세 주소' })
  detailAddress: string;

  @OneToOne(() => UserProfileImageEntity, (image) => image.userProfile)
  image: UserProfileImageEntity;

  @OneToOne(() => UserEntity, (user) => user.profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

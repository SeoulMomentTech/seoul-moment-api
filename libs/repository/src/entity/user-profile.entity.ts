import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
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

  @Column('varchar', { length: 255, nullable: true, comment: '닉네임' })
  nickname?: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '프로필 이미지 경로',
  })
  imagePath?: string;

  @Index()
  @Column('varchar', { length: 255, nullable: false, comment: '이름' })
  name: string;

  @Column('enum', {
    enum: UserProfileGender,
    default: UserProfileGender.OTHER,
    nullable: false,
    comment: '성별',
  })
  gender: UserProfileGender;

  @Column('date', { nullable: false, comment: '생년월일' })
  birthDate: string;

  @Column('varchar', { length: 255, nullable: false, comment: '우편번호' })
  postalCode: string;

  @Column('varchar', { length: 255, nullable: false, comment: '시/도' })
  city: string;

  @Column('varchar', { length: 255, nullable: false, comment: '시/군/구' })
  district: string;

  @Column('varchar', { length: 255, nullable: false, comment: '상세 주소' })
  detailAddress: string;

  @Column('boolean', {
    nullable: false,
    default: true,
    comment: '프로필 공개 범위',
  })
  visibility: boolean;

  //TODO 신분증 정보 작성

  @OneToOne(() => UserEntity, (user) => user.profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

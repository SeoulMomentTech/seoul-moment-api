import bcrypt from 'bcrypt';
import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { UserBrandLikeEntity } from './user-brand-like.entity';
import { UserFitEntity } from './user-fit.entity';
import { UserProductLikeEntity } from './user-product-like.entity';
import { UserProfileEntity } from './user-profile.entity';
import { UserSnsEntity } from './user-sns.entity';
import { UserRecentEntity } from './user.recent.entity';

@Entity('user')
export class UserEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', {
    length: 255,
    nullable: false,
    unique: true,
    comment: '이메일 (로그인 ID)',
  })
  email: string;

  @Column('varchar', {
    length: 255,
    nullable: false,
    select: false,
    comment: '암호화된 비밀번호',
  })
  password: string;

  @Column('varchar', {
    length: 255,
    nullable: false,
    unique: true,
    comment: '전화번호',
  })
  phone: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    select: false,
    comment: '리프레시 토큰',
  })
  refreshToken: string;

  @Column('timestamp', {
    nullable: true,
    comment: '광고성 이메일 수신 동의 일시 (동의 시점에만 기록)',
  })
  adAgreeEmailDate: Date | null;

  @Column('timestamp', {
    nullable: true,
    comment: '추천 이메일 수신 동의 일시 (동의 시점에만 기록)',
  })
  recommendEmailDate: Date | null;

  @Column('timestamp', {
    nullable: true,
    comment: '추천 문자 수신 동의 일시 (동의 시점에만 기록)',
  })
  recommendPhoneDate: Date | null;

  @Column('timestamp', {
    nullable: true,
    comment: '개인정보 수집 동의 일시 (동의 시점에만 기록)',
  })
  personalInfoAgreeDate: Date | null;

  @OneToOne(() => UserProfileEntity, (profile) => profile.user)
  profile: UserProfileEntity;

  @OneToOne(() => UserFitEntity, (fit) => fit.user)
  fit: UserFitEntity;

  @OneToMany(() => UserSnsEntity, (sns) => sns.user)
  snsList: UserSnsEntity[];

  @OneToMany(() => UserBrandLikeEntity, (like) => like.user)
  brandLikes: UserBrandLikeEntity[];

  @OneToMany(() => UserProductLikeEntity, (like) => like.user)
  productLikes: UserProductLikeEntity[];

  @OneToMany(() => UserRecentEntity, (recent) => recent.user)
  userRecents: UserRecentEntity[];

  async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}

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
    comment: '닉네임',
    unique: true,
  })
  nickname: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    unique: true,
    comment: '전화번호',
  })
  phone?: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    select: false,
    comment: '리프레시 토큰',
  })
  refreshToken?: string;

  @Column('timestamp', {
    nullable: false,
    comment: '이용약관 동의 일시',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
  })
  termsOfServiceAgreeDate: Date;

  @Column('timestamp', {
    nullable: false,
    comment: '개인정보 수집 및 이용 동의 일시',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
  })
  privacyPolicyAgreeDate: Date;

  @Column('timestamp', {
    nullable: true,
    comment: '신상품 및 기획전 출시 알림',
  })
  newProductDate: Date | null;

  @Column('timestamp', {
    nullable: true,
    comment: '광고 및 이벤트 할인 이메일',
  })
  adAgreeDate: Date | null;

  @Column('timestamp', {
    nullable: true,
    comment: '개인 맞춤 상품 추천 알림',
  })
  recommendDate: Date | null;

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

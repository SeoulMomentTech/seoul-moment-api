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
import { UserSnsProvider } from '../enum/user-sns.enum';

/**
 * user 1 : sns 1. user_id 를 단독 PK 로 두어 한 계정에 SNS 를 하나만
 * 연결한다. 구글로 가입한 계정에 LINE 을 덧붙이는 것은 허용하지 않는다.
 */
@Entity('user_sns')
@Index('uq_user_sns_provider_id', ['provider', 'providerUserId'], {
  unique: true,
})
export class UserSnsEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조, user당 1행)',
  })
  userId: number;

  @Column('enum', {
    enum: UserSnsProvider,
    nullable: false,
    comment: 'SNS 제공자',
  })
  provider: UserSnsProvider;

  @Column('varchar', {
    length: 255,
    nullable: false,
    comment: 'SNS 계정 고유 ID',
  })
  providerUserId: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: 'SNS 계정 이메일',
  })
  providerEmail: string | null;

  @OneToOne(() => UserEntity, (user) => user.sns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

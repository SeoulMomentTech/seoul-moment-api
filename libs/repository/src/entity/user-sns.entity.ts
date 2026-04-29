import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { UserEntity } from './user.entity';
import { UserSnsProvider } from '../enum/user-sns.enum';

@Entity('user_sns')
@Index('uq_user_sns_provider_id', ['provider', 'providerUserId'], {
  unique: true,
})
export class UserSnsEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조)',
  })
  userId: number;

  @PrimaryColumn('enum', {
    enum: UserSnsProvider,
    comment: 'SNS 제공자 (PK, user당 provider별 1행)',
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

  @ManyToOne(() => UserEntity, (user) => user.snsList, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

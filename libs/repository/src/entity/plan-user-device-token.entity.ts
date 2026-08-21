import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanUserEntity } from './plan-user.entity';
import { DevicePlatform } from '../enum/plan-user-device-token.enum';

/**
 * FCM 기기 토큰. 한 유저가 기기를 여러 대 쓸 수 있으므로 유저당 여러 행이다.
 *
 * token 에 unique 를 거는 이유: 같은 기기를 다른 계정으로 다시 로그인하면 FCM 은
 * 같은 토큰을 그대로 내려준다. 유저별로 행을 따로 쌓으면 이전 계정 알림이 그 기기로
 * 계속 가므로, 토큰 하나당 행 하나를 유지하고 소유자만 바꿔치운다.
 */
@Index(['planUserId'])
@Entity('plan_user_device_token')
export class PlanUserDeviceTokenEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @Column('varchar', {
    length: 512,
    nullable: false,
    unique: true,
    comment: 'FCM 등록 토큰',
  })
  token: string;

  @Column('enum', {
    enum: DevicePlatform,
    default: DevicePlatform.ANDROID,
    nullable: false,
  })
  platform: DevicePlatform;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.deviceTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

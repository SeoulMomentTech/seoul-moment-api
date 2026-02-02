import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanUserStatus } from '../enum/plan-user.enum';

@Entity('plan_user')
export class PlanUserEntity extends CommonEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int', { nullable: true })
  naverId: number;

  @Column('varchar', { length: 255, nullable: true })
  naverEmail: string;

  @Column('bigint', { nullable: true, comment: 'kakao id' })
  kakaoId: number;

  @Column('varchar', { length: 255, nullable: true })
  kakaoEmail: string;

  @Column('int', { nullable: true })
  googleId: number;

  @Column('varchar', { length: 255, nullable: true })
  googleEmail: string;

  @Column('date', { nullable: true, comment: '웨딩 날짜' })
  weddingDate: Date;

  @Column('int', { nullable: true, comment: '예산 (만원 단위)' })
  budget: number;

  @Column('varchar', { length: 255, nullable: true, comment: '이름/닉네임' })
  name: string;

  @Column('enum', {
    enum: PlanUserStatus,
    default: PlanUserStatus.NORMAL,
    nullable: false,
  })
  status: PlanUserStatus;
}

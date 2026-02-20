import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ChatMessageEntity } from './chat-message.entity';
import { CommonEntity } from './common.entity';
import { PlanScheduleEntity } from './plan-schedule.entity';
import { PlanUserCategoryEntity } from './plan-user-category.entity';
import { PlanUserRoomMemberEntity } from './plan-user-room-member.entity';
import { PlanUserRoomEntity } from './plan-user-room.entity';
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

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '플랜 유저 이미지',
  })
  profileImageUrl: string;

  @Column('varchar', { length: 255, nullable: false, comment: '방 공유 코드' })
  roomShareCode: string;

  @Column('date', {
    nullable: true,
    comment: '메인 가이드 조회 여부',
  })
  hasSeenMainGuideDate: Date;

  @Column('date', {
    nullable: true,
    comment: '예산 가이드 조회 여부',
  })
  hasSeenBudgetGuideDate: Date;

  @Column('enum', {
    enum: PlanUserStatus,
    default: PlanUserStatus.NORMAL,
    nullable: false,
  })
  status: PlanUserStatus;

  @OneToMany(() => PlanScheduleEntity, (schedule) => schedule.planUser, {
    cascade: true,
  })
  schedules: PlanScheduleEntity[];

  @OneToMany(() => PlanUserCategoryEntity, (category) => category.planUser, {
    cascade: true,
  })
  categories: PlanUserCategoryEntity[];

  @OneToOne(() => PlanUserRoomEntity, (room) => room.owner, {
    cascade: true,
  })
  room: PlanUserRoomEntity;

  @OneToMany(() => PlanUserRoomMemberEntity, (member) => member.planUser, {
    cascade: true,
  })
  members: PlanUserRoomMemberEntity[];

  @OneToMany(() => ChatMessageEntity, (message) => message.planUser, {
    cascade: true,
  })
  chatMessages: ChatMessageEntity[];

  @Column('timestamp', { nullable: true, comment: '마지막 로그인 일시' })
  lastLoginDate: Date;

  getProfileImageUrl(): string {
    return this.profileImageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.profileImageUrl}`
      : null;
  }
}

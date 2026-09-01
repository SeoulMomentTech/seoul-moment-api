import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ChatMessageEntity } from './chat-message.entity';
import { ChatRoomMemberEntity } from './chat-room-member.entity';
import { CommonEntity } from './common.entity';
import { PlanScheduleEntity } from './plan-schedule.entity';
import { PlanUserCategoryEntity } from './plan-user-category.entity';
import { PlanUserDeviceTokenEntity } from './plan-user-device-token.entity';
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

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '예식장 이름',
  })
  weddingVenue: string;

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

  @Column('date', {
    nullable: true,
    comment: '채팅 가이드 조회 여부',
  })
  hasSeenChatGuideDate: Date;

  @Column('date', {
    nullable: true,
    comment: '필수 동의 여부',
  })
  requiredAgreementDate: Date;

  @Column('date', {
    nullable: true,
    comment: '광고 동의 여부',
  })
  adAgreementDate: Date;

  @Column('enum', {
    enum: PlanUserStatus,
    default: PlanUserStatus.NORMAL,
    nullable: false,
  })
  status: PlanUserStatus;

  /**
   * 토큰 세대. 발급된 JWT 는 이 값을 함께 들고 다니고, 가드가 매 요청 대조한다.
   *
   * 로그인 세션이 길어진 만큼(180일) 토큰을 되돌려 받을 수단이 있어야 한다.
   * 이 값을 1 올리면 그 사용자에게 나간 **모든 기기의 토큰이 즉시 무효**가 된다.
   * 기기별로 끊을 수는 없다 — 그러려면 세션 테이블이 따로 필요하다.
   *
   * 예전 토큰에는 이 클레임이 없으므로 가드가 `?? 0` 으로 읽는다.
   * 기본값을 0 이 아닌 값으로 바꾸면 기존 사용자가 전부 로그아웃된다.
   */
  @Column('int', {
    default: 0,
    nullable: false,
    comment: '토큰 세대. 올리면 발급된 JWT 가 전부 무효가 된다',
  })
  tokenVersion: number;

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

  @OneToMany(() => ChatRoomMemberEntity, (member) => member.planUser, {
    cascade: true,
  })
  chatRoomMembers: ChatRoomMemberEntity[];

  @OneToMany(() => PlanUserDeviceTokenEntity, (token) => token.planUser, {
    cascade: true,
  })
  deviceTokens: PlanUserDeviceTokenEntity[];

  @Column('timestamp', { nullable: true, comment: '마지막 로그인 일시' })
  lastLoginDate: Date;

  getProfileImageUrl(): string {
    return this.profileImageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.profileImageUrl}`
      : null;
  }
}

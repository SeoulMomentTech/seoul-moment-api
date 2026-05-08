import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { UserEntity } from './user.entity';

@Entity('user_fit')
export class UserFitEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조)',
  })
  userId: number;

  @Column('int', { nullable: false, comment: '키 (cm)' })
  height: number;

  @Column('int', { nullable: false, comment: '몸무게 (kg)' })
  weight: number;

  @Column('int', { nullable: false, comment: '신발 사이즈 (mm 단위, 예: 270)' })
  shoeSize: number;

  @Column('varchar', {
    length: 10,
    nullable: false,
    comment: '아우터 사이즈 (예: S/M/L/XL, 95/100/105)',
  })
  outerSize: string;

  @Column('varchar', {
    length: 10,
    nullable: false,
    comment: '상의 사이즈 (예: S/M/L/XL, 95/100/105)',
  })
  topSize: string;

  @Column('varchar', {
    length: 10,
    nullable: false,
    comment: '하의 사이즈 (예: 28/30/32, S/M/L)',
  })
  bottomSize: string;

  @OneToOne(() => UserEntity, (user) => user.fit, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

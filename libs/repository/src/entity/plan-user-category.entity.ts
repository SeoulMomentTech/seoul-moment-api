import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanUserEntity } from './plan-user.entity';

@Entity('plan_user_category')
export class PlanUserCategoryEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.categories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

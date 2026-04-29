import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { BrandEntity } from './brand.entity';
import { UserEntity } from './user.entity';

@Entity('user_brand_like')
export class UserBrandLikeEntity extends BaseEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조)',
  })
  userId: number;

  @PrimaryColumn({
    name: 'brand_id',
    type: 'int',
    comment: '브랜드 ID (PK, brand.id 참조)',
  })
  brandId: number;

  @Index()
  @CreateDateColumn({
    type: 'timestamp',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
    comment: '좋아요 등록 일시',
  })
  createDate: Date;

  @ManyToOne(() => UserEntity, (user) => user.brandLikes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => BrandEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;
}

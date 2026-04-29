import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { ProductEntity } from './product.entity';
import { UserEntity } from './user.entity';

@Entity('user_product_like')
export class UserProductLikeEntity extends BaseEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조)',
  })
  userId: number;

  @PrimaryColumn({
    name: 'product_id',
    type: 'int',
    comment: '상품 ID (PK, product.id 참조)',
  })
  productId: number;

  @Index()
  @CreateDateColumn({
    type: 'timestamp',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
    comment: '좋아요 등록 일시',
  })
  createDate: Date;

  @ManyToOne(() => UserEntity, (user) => user.productLikes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;
}

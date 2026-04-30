import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { ProductItemEntity } from './product-item.entity';
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
    name: 'product_item_id',
    type: 'int',
    comment: '상품 아이템 ID (PK, product_item.id 참조)',
  })
  productItemId: number;

  @Index()
  @CreateDateColumn({
    type: 'timestamp',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
    comment: '좋아요 등록 일시',
  })
  createDate: Date;

  @ManyToOne(() => UserEntity, (user) => user.productLikes, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(
    () => ProductItemEntity,
    (productItem) => productItem.userProductLikes,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'product_item_id' })
  productItem: ProductItemEntity;
}

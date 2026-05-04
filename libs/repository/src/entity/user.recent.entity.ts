import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { ProductItemEntity } from './product-item.entity';
import { UserEntity } from './user.entity';

@Entity('user_recent')
@Index(['userId', 'updateDate'])
export class UserRecentEntity extends CommonEntity {
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

  @ManyToOne(() => UserEntity, (user) => user.userRecents, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(
    () => ProductItemEntity,
    (productItem) => productItem.userRecents,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'product_item_id' })
  productItem: ProductItemEntity;
}

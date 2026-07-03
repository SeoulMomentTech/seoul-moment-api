import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { LookbookEntity } from './lookbook.entity';
import { UserEntity } from './user.entity';

@Entity('user_lookbook_like')
export class UserLookbookLikeEntity extends BaseEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조)',
  })
  userId: number;

  @PrimaryColumn({
    name: 'lookbook_id',
    type: 'int',
    comment: '룩북 게시글 ID (PK, lookbook.id 참조)',
  })
  lookbookId: number;

  @Index()
  @CreateDateColumn({
    type: 'timestamp',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
    comment: '좋아요 등록 일시',
  })
  createDate: Date;

  @ManyToOne(() => UserEntity, (user) => user.lookbookLikes, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => LookbookEntity, (lookbook) => lookbook.userLookbookLikes, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'lookbook_id' })
  lookbook: LookbookEntity;
}

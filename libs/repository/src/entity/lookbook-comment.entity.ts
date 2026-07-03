import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { LookbookEntity } from './lookbook.entity';
import { UserEntity } from './user.entity';

@Entity('lookbook_comment')
@Index(['lookbookId', 'parentId'])
export class LookbookCommentEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'lookbook_id',
    nullable: false,
    comment: '룩북 게시글 ID',
  })
  lookbookId: number;

  @Column('int', { name: 'user_id', nullable: false, comment: '작성자 ID' })
  userId: number;

  @Column('int', {
    name: 'parent_id',
    nullable: true,
    comment: '부모 댓글 ID (null이면 최상위 댓글, 1-depth만 허용)',
  })
  parentId: number | null;

  @Column('text', { name: 'content', nullable: false, comment: '댓글 내용' })
  content: string;

  @ManyToOne(() => LookbookEntity, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'lookbook_id' })
  lookbook: LookbookEntity;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => LookbookCommentEntity, (comment) => comment.replies, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: LookbookCommentEntity | null;

  @OneToMany(() => LookbookCommentEntity, (comment) => comment.parent)
  replies: LookbookCommentEntity[];

  isReply(): boolean {
    return this.parentId !== null;
  }
}

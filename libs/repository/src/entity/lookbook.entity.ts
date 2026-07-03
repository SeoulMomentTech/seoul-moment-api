import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { UserLookbookLikeEntity } from './user-lookbook-like.entity';
import { UserEntity } from './user.entity';

@Entity('lookbook')
export class LookbookEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'user_id', nullable: false })
  user_id: number;

  @Column('varchar', { name: 'title', length: 255, nullable: false })
  title: string;

  @Column('text', { name: 'description', nullable: false })
  description: string;

  @Column('varchar', { name: 'image_url', length: 500, nullable: false })
  imagePath: string;

  @ManyToOne(() => UserEntity, (user) => user.lookbooks, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => UserLookbookLikeEntity, (like) => like.lookbook)
  userLookbookLikes: UserLookbookLikeEntity[];

  getImageUrl(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imagePath}`;
  }
}

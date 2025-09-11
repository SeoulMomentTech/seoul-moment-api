import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CategoryEntity } from './category.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * 협력사 테이블
 * 다국어 지원: title, description
 */
@Entity(EntityType.PARTNER)
export class PartnerEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'category_id', nullable: false })
  categoryId: number;

  @Column('varchar', { length: 255, nullable: true })
  image: string;

  @Column('varchar', { length: 255, nullable: true })
  link: string;

  @ManyToOne(() => CategoryEntity, (category) => category.partner, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.image}`;
  }
}

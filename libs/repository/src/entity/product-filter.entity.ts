import { DatabaseSort } from '@app/common/enum/global.enum';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [name]
 */
@Index(['sortOrder'], { unique: true })
@Entity(EntityType.PRODUCT_FILTER)
export class ProductFilterEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 50, nullable: false })
  sortColumn: string;

  @Column('enum', {
    enum: DatabaseSort,
    default: DatabaseSort.ASC,
    nullable: false,
  })
  sort: DatabaseSort;

  @Column('int', { default: 1, nullable: false })
  sortOrder: number;

  @Column('boolean', { default: true, nullable: false })
  isActive: boolean;

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

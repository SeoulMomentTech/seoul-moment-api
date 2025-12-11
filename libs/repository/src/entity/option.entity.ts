import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { OptionValueEntity } from './option-value.entity';
import { EntityType } from '../enum/entity.enum';
import { OptionUiType } from '../enum/option.enum';
import { OptionType } from '../enum/product.enum';

/**
 * 옵션 종류 Entity
 * - 옵션의 종류를 정의 (색상, 사이즈, 소재 등)
 * - 다국어 지원: name
 */
@Entity(EntityType.OPTION)
@Index(['type'])
export class OptionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('enum', {
    enum: OptionType,
    nullable: false,
    comment: '옵션 타입 (COLOR/SIZE/MATERIAL/FIT/STYLE)',
  })
  type: OptionType;

  @Column('enum', {
    enum: OptionUiType,
    nullable: false,
    default: OptionUiType.RADIO,
  })
  uiType: OptionUiType;

  @Column('int', {
    name: 'sort_order',
    default: 1,
    comment: '정렬 순서',
  })
  sortOrder: number;

  @Column('boolean', {
    name: 'is_active',
    default: true,
    comment: '활성화 여부',
  })
  isActive: boolean;

  // Relations
  @OneToMany(() => OptionValueEntity, (value) => value.option, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  values: OptionValueEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

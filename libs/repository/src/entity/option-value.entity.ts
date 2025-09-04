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
import { MultilingualTextEntity } from './multilingual-text.entity';
import { OptionEntity } from './option.entity';
import { VariantOptionEntity } from './variant-option.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * 옵션 값 Entity
 * - 실제 옵션 값을 정의 (빨강, M사이즈, 면100% 등)
 * - 다국어 지원: value
 * - 색상별 대표 이미지 지원
 */
@Entity(EntityType.OPTION_VALUE)
export class OptionValueEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'option_id',
    nullable: false,
    comment: '옵션 ID',
  })
  optionId: number;

  @Column('varchar', {
    name: 'color_code',
    length: 7,
    nullable: true,
    comment: '색상 코드 (예: #FF0000, 색상 옵션용)',
  })
  colorCode: string;

  @Column('varchar', {
    name: 'representative_image_url',
    length: 500,
    nullable: true,
    comment: '이 옵션값의 대표 이미지 URL (색상별 상품 리스트용)',
  })
  representativeImageUrl: string;

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
  @ManyToOne(() => OptionEntity, (option) => option.values, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'option_id' })
  option: OptionEntity;

  @OneToMany(
    () => VariantOptionEntity,
    (variantOption) => variantOption.optionValue,
    {
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  variantOptions: VariantOptionEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  // Utility methods
  getRepresentativeImage(): string {
    return this.representativeImageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.representativeImageUrl}`
      : '';
  }
}

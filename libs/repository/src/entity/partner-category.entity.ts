import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { PartnerEntity } from './partner.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * 협력사용 카테고리
 * 다국어: name
 */
@Entity(EntityType.PARTNER_CATEGORY)
export class PartnerCategoryEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    default: 1,
    nullable: false,
    comment: '정렬 순서',
  })
  sortOrder: number;

  @OneToMany(() => PartnerEntity, (partner) => partner.partnerCategory, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  partner: PartnerEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

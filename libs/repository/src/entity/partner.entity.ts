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
import { PartnerCategoryEntity } from './partner-category.entity';
import { EntityType } from '../enum/entity.enum';
import { LanguageCode } from '../enum/language.enum';

/**
 * 협력사 테이블
 * 다국어 지원: title, description
 */
@Entity(EntityType.PARTNER)
export class PartnerEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'partner_category_id', nullable: false })
  partnerCategoryId: number;

  @Column('enum', {
    enum: LanguageCode,
    default: LanguageCode.KOREAN,
    nullable: false,
  })
  country: LanguageCode;

  @Column('varchar', { length: 255, nullable: true })
  image: string;

  @Column('varchar', { length: 500, nullable: true })
  link: string;

  @ManyToOne(() => PartnerCategoryEntity, (category) => category.partner, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'partner_category_id' })
  partnerCategory: PartnerCategoryEntity;

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.image}`;
  }
}

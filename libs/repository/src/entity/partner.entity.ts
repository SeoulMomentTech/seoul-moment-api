import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PartnerCategoryEntity } from './partner-category.entity';
import { EntityType } from '../enum/entity.enum';

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

  @Column('varchar', { length: 255, nullable: true })
  image: string;

  @Column('varchar', { length: 500, nullable: true })
  link: string;

  @ManyToOne(() => PartnerCategoryEntity, (category) => category.partner, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'partner_category_id' })
  partnerCategory: PartnerCategoryEntity;

  getImage(): string {
    return this.image
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.image}`
      : null;
  }
}

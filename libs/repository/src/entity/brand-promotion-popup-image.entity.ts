import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandPromotionPopupEntity } from './brand-promotion-popup.entity';
import { CommonEntity } from './common.entity';

@Entity('brand_promotion_popup_image')
export class BrandPromotionPopupImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_popup_id', nullable: false })
  brandPromotionPopupId: number;

  @Column('varchar', { length: 500, nullable: false })
  imagePath: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => BrandPromotionPopupEntity, (popup) => popup.images, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'brand_promotion_popup_id' })
  popup: BrandPromotionPopupEntity;

  getImageUrl(): string {
    return this.imagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imagePath}`
      : null;
  }
}

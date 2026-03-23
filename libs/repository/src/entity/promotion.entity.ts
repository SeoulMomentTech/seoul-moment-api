import { Configuration } from '@app/config/configuration';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { BrandPromotionEntity } from './brand-promotion.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [title, description]
 */
@Entity(EntityType.PROMOTION)
export class PromotionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: false })
  bannerImagePath: string;

  @Column('varchar', { length: 255, nullable: false })
  bannerMobileImagePath: string;

  @Column('varchar', { length: 255, nullable: false })
  thumbnailImagePath: string;

  @Column('timestamp', { nullable: false })
  startDate: Date;

  @Column('timestamp', { nullable: false })
  endDate: Date;

  @Column('boolean', { default: true, nullable: false })
  isActive: boolean;

  @OneToMany(
    () => BrandPromotionEntity,
    (brandPromotion) => brandPromotion.promotion,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  brandPromotions: BrandPromotionEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  getBannerImageUrl(): string {
    return this.bannerImagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.bannerImagePath}`
      : null;
  }

  getBannerMobileImageUrl(): string {
    return this.bannerMobileImagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.bannerMobileImagePath}`
      : null;
  }

  getThumbnailImageUrl(): string {
    return this.thumbnailImagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.thumbnailImagePath}`
      : null;
  }
}

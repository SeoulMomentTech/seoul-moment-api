import { Configuration } from '@app/config/configuration';
import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { BrandPromotionBannerEntity } from './brand-promotion-banner.entity';
import { CommonEntity } from './common.entity';
import { DeviceType } from '../dto/common.dto';

@Entity('brand_promotion_banner_image')
export class BrandPromotionBannerImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_banner_id', nullable: false })
  brandPromotionBannerId: number;

  @Column('varchar', { length: 500, nullable: false })
  imagePath: string;

  @Column('enum', {
    enum: DeviceType,
    nullable: false,
    default: DeviceType.DESKTOP,
  })
  deviceType: DeviceType;

  @ManyToOne(
    () => BrandPromotionBannerEntity,
    (brandPromotionBanner) => brandPromotionBanner.images,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'brand_promotion_banner_id' })
  brandPromotionBanner: BrandPromotionBannerEntity;

  getImage(): string {
    return this.imagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imagePath}`
      : null;
  }
}

import { Configuration } from '@app/config/configuration';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { HomeBannerStatus } from '../enum/home-banner-image.enum';

@Entity('home_banner_image')
export class HomeBannerImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { name: 'image_url', length: 500, nullable: true })
  imageUrl: string;

  @Column('varchar', { name: 'mobile_image_url', length: 500, nullable: true })
  mobileImageUrl: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @Column('enum', {
    enum: HomeBannerStatus,
    default: HomeBannerStatus.NORMAL,
    nullable: false,
  })
  @Index('idx_home_banner_image_status')
  status: HomeBannerStatus;

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`;
  }
  getMobileImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.mobileImageUrl}`;
  }
}

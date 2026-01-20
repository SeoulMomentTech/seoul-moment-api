import { Configuration } from '@app/config/configuration';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';

@Entity('product_banner')
@Index(['sortOrder'])
export class ProductBannerEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 500, nullable: true })
  image: string;

  @Column('varchar', { length: 500, nullable: true })
  mobileImage: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  getImage(): string {
    return this.image
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.image}`
      : null;
  }
  getMobileImage(): string {
    return this.mobileImage
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.mobileImage}`
      : null;
  }
}

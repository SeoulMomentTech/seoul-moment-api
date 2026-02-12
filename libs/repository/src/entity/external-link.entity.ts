import { Configuration } from '@app/config/configuration';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { ProductExternalEntity } from './product-external.entity';

@Entity('external_link')
export class ExternalLinkEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @Column('varchar', { length: 255, nullable: false })
  imageUrl: string;

  @OneToMany(
    () => ProductExternalEntity,
    (productExternal) => productExternal.externalLink,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  productExternals: ProductExternalEntity[];

  getImageUrl(): string {
    return this.imageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`
      : null;
  }
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { ExternalLinkEntity } from './external-link.entity';
import { ProductItemEntity } from './product-item.entity';

@Entity('product_external')
export class ProductExternalEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'product_item_id', nullable: false })
  productItemId: number;

  @Column('int', { name: 'external_link_id', nullable: false })
  externalLinkId: number;

  @Column('text', { nullable: true })
  url: string;

  @ManyToOne(
    () => ExternalLinkEntity,
    (externalLink) => externalLink.productExternals,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'external_link_id' })
  externalLink: ExternalLinkEntity;

  @ManyToOne(
    () => ProductItemEntity,
    (productItem) => productItem.productExternals,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'product_item_id' })
  productItem: ProductItemEntity;
}

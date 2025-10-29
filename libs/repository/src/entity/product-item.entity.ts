import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { ProductItemImageEntity } from './product-item-image.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { ProductEntity } from './product.entity';
import { ProductItemStatus } from '../enum/product.enum';

@Entity('product_item')
@Index(['productId'])
export class ProductItemEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'product_id',
    comment: '상품 변형 ID',
  })
  productId: number;

  @Column('varchar', {
    name: 'main_image_url',
    length: 500,
    nullable: true,
    comment: '목록 페이지용 대표 이미지 URL',
  })
  mainImageUrl: string;

  @Column('int', {
    default: 0,
    nullable: false,
    comment: '가격',
  })
  price: number;

  @Column('int', {
    default: 0,
    nullable: true,
    comment: '할인 가격',
  })
  discountPrice: number;

  @Column('int', {
    nullable: false,
    default: 0,
    comment: '배송비용',
  })
  shippingCost: number;

  @Column('int', {
    nullable: false,
    default: 0,
    comment: '배송출고 정보',
  })
  shippingInfo: number;

  @Column('enum', {
    enum: ProductItemStatus,
    default: ProductItemStatus.NORMAL,
    nullable: false,
    comment: '상품 상태',
  })
  status: ProductItemStatus;

  getEffectivePrice(): number {
    return this.discountPrice || this.price;
  }

  getMainImage(): string {
    return this.mainImageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.mainImageUrl}`
      : '';
  }

  @ManyToOne(() => ProductEntity, (product) => product.productItems, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    eager: false,
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @OneToMany(() => ProductItemImageEntity, (image) => image.productItem, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  images: ProductItemImageEntity[];

  @OneToMany(() => ProductVariantEntity, (variant) => variant.productItem, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  variants: ProductVariantEntity[];
}

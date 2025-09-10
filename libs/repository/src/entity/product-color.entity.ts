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
import { OptionValueEntity } from './option-value.entity';
import { ProductColorImageEntity } from './product-color-image.entity';
import { ProductEntity } from './product.entity';
import { ProductColorStatus } from '../enum/product.enum';

@Entity('product_color')
@Index(['productId', 'optionValueId'], { unique: true })
export class ProductColorEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'product_id',
    comment: '상품 변형 ID',
  })
  productId: number;

  @Column('int', {
    name: 'option_value_id',
    comment: '옵션 값 ID',
  })
  optionValueId: number;

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
    enum: ProductColorStatus,
    default: ProductColorStatus.NORMAL,
    nullable: false,
    comment: '상품 상태',
  })
  status: ProductColorStatus;

  getEffectivePrice(): number {
    return this.discountPrice || this.price;
  }

  getMainImage(): string {
    return this.mainImageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.mainImageUrl}`
      : '';
  }

  @ManyToOne(() => ProductEntity, (product) => product.productColors, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @ManyToOne(
    () => OptionValueEntity,
    (optionValue) => optionValue.variantOptions,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'option_value_id' })
  optionValue: OptionValueEntity;

  @OneToMany(() => ProductColorImageEntity, (image) => image.productColor, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  images: ProductColorImageEntity[];
}

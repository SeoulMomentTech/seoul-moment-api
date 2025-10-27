import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandEntity } from './brand.entity';
import { CategoryEntity } from './category.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { ProductCategoryEntity } from './product-category.entity';
import { ProductImageEntity } from './product-image.entity';
import { ProductItemEntity } from './product-item.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { EntityType } from '../enum/entity.enum';
import { ProductStatus } from '../enum/product.enum';

/**
 * 상품 기본 정보 Entity
 * - 상품군을 나타냄 (예: "나이키 드라이핏 티셔츠")
 * - 실제 판매는 ProductVariant에서 이루어짐
 * - 다국어 지원: name, origin(원산지), gender
 */
@Entity(EntityType.PRODUCT)
export class ProductEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('enum', {
    enum: ProductStatus,
    default: ProductStatus.NORMAL,
    nullable: false,
    comment: '상품 상태',
  })
  status: ProductStatus;

  @Column('int', {
    name: 'brand_id',
    nullable: false,
    comment: '브랜드 ID',
  })
  brandId: number;

  @Column('int', {
    name: 'category_id',
    nullable: true,
    comment: '카테고리 ID',
  })
  categoryId: number;

  @Column('int', {
    name: 'product_category_id',
    nullable: true,
    comment: '상품 카테고리 ID',
  })
  productCategoryId: number;

  @Column('varchar', {
    name: 'detail_info_image_url',
    length: 500,
    nullable: true,
    comment: '상세 페이지 하단 긴 상품 정보 이미지 URL',
  })
  detailInfoImageUrl: string;
  // Relations
  @ManyToOne(() => BrandEntity, (brand) => brand.products, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;

  @ManyToOne(() => CategoryEntity, (category) => category.products, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @ManyToOne(
    () => ProductCategoryEntity,
    (productCategory) => productCategory.products,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'product_category_id' })
  productCategory: ProductCategoryEntity;

  @OneToMany(() => ProductVariantEntity, (variant) => variant.product, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  variants: ProductVariantEntity[];

  @OneToMany(() => ProductImageEntity, (image) => image.product, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  images: ProductImageEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  @OneToMany(() => ProductItemEntity, (productItem) => productItem.product, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  productItems: ProductItemEntity[];

  getDetailInfoImage(): string {
    return this.detailInfoImageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.detailInfoImageUrl}`
      : '';
  }
}

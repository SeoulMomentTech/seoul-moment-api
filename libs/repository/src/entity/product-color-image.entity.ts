import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { ProductColorEntity } from './product-color.entity';
import { ProductImageType } from '../enum/product.enum';

/**
 * 상품 갤러리 이미지 Entity
 * - 상세 페이지 상단 갤러리용 이미지들
 * - 현재 프로젝트 패턴 동일 (BrandBannerImageEntity 구조 참조)
 */
@Entity('product_color_image')
@Index(['productColotId', 'sortOrder'])
@Index(['productColotId', 'imageType'])
export class ProductColorImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'product_color_id',
    nullable: false,
    comment: '상품 컬러 ID',
  })
  productColotId: number;

  @Column('varchar', {
    name: 'image_url',
    length: 500,
    nullable: false,
    comment: '이미지 URL',
  })
  imageUrl: string;

  @Column('enum', {
    name: 'image_type',
    enum: ProductImageType,
    default: ProductImageType.GALLERY,
    nullable: false,
    comment: '이미지 타입 (MAIN/GALLERY/THUMBNAIL)',
  })
  imageType: ProductImageType;

  @Column('varchar', {
    name: 'alt_text',
    length: 200,
    nullable: true,
    comment: '접근성을 위한 alt 텍스트',
  })
  altText: string;

  @Column('varchar', {
    name: 'caption',
    length: 300,
    nullable: true,
    comment: '이미지 설명/캡션',
  })
  caption: string;

  @Column('int', {
    name: 'sort_order',
    default: 1,
    nullable: false,
    comment: '정렬 순서',
  })
  sortOrder: number;

  // Relations
  @ManyToOne(() => ProductColorEntity, (product) => product.images, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'product_color_id' })
  productColor: ProductColorEntity;

  // Utility methods
  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`;
  }
}

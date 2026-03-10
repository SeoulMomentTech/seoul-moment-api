import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandPromotionEventCouponEntity } from './brand-promotion-event-coupon.entity';
import { BrandPromotionEntity } from './brand-promotion.entity';
import { CommonEntity } from './common.entity';
import { BrandPromotionEventStatus } from '../enum/brand-promotion-event.enum';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [title]
 */
@Entity(EntityType.BRAND_PROMOTION_EVENT)
export class BrandPromotionEventEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_id', nullable: false })
  brandPromotionId: number;

  @Column('enum', {
    enum: BrandPromotionEventStatus,
    default: BrandPromotionEventStatus.NORMAL,
    nullable: false,
  })
  status: BrandPromotionEventStatus;

  @ManyToOne(
    () => BrandPromotionEntity,
    (brandPromotion) => brandPromotion.events,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'brand_promotion_id' })
  brandPromotion: BrandPromotionEntity;

  @OneToMany(
    () => BrandPromotionEventCouponEntity,
    (coupon) => coupon.brandPromotionEvent,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  coupons: BrandPromotionEventCouponEntity[];
}

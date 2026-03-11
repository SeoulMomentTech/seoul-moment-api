import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandPromotionEventEntity } from './brand-promotion-event.entity';
import { CommonEntity } from './common.entity';
import { BrandPromotionEventCouponStatus } from '../enum/brand-promotion-event-coupon.enum';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [title, description]
 */
@Entity(EntityType.BRAND_PROMOTION_EVENT_COUPON)
export class BrandPromotionEventCouponEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_event_id', nullable: false })
  brandPromotionEventId: number;

  @Column('varchar', { length: 500, nullable: false })
  imagePath: string;

  @Column('enum', {
    enum: BrandPromotionEventCouponStatus,
    default: BrandPromotionEventCouponStatus.NORMAL,
    nullable: false,
  })
  status: BrandPromotionEventCouponStatus;

  @ManyToOne(
    () => BrandPromotionEventEntity,
    (brandPromotionEvent) => brandPromotionEvent.coupons,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'brand_promotion_event_id' })
  brandPromotionEvent: BrandPromotionEventEntity;

  getImageUrl(): string {
    return this.imagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imagePath}`
      : null;
  }
}

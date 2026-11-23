import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';

/**
 * 국제배송비 지원 할인 구간 (명세 v6 §2). 금액이 클수록 큰 구간 하나만 적용한다.
 * shortcut: 구간 값은 코드 상수, ADMIN 편집 UI 없음 — 손익 검증으로 값이 바뀌면 설정 테이블로 옮긴다.
 */
export const INTERNATIONAL_DISCOUNT_TIERS: ReadonlyArray<{
  threshold: number;
  discount: number;
}> = [
  { threshold: 4000, discount: 120 },
  { threshold: 5000, discount: 250 },
  { threshold: 8000, discount: 450 },
  { threshold: 12000, discount: 700 },
];

/**
 * 배송비 정책 (단일 행 테이블, id = 1)
 *
 * 배송비는 상품이나 브랜드가 아니라 **배송지 지역**으로 정해진다.
 * 본섬 base_fee, 외섬 remote_island_fee 두 단계이고, 상품 금액 합이
 * free_shipping_threshold 이상이면 지역과 무관하게 0 이다.
 *
 * remote_island_fee 를 프로모션가로 덮어쓰지 않고 remote_island_promotion
 * 플래그를 따로 둔 이유: 덮어쓰면 정상 요금을 잃어버려 프로모션 종료 시
 * 원복할 근거가 사라진다. 플래그면 토글 한 번으로 복귀한다.
 */
@Entity('shipping_policy')
export class ShippingPolicyEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'base_fee',
    nullable: false,
    default: 60,
    comment: '본섬 배송비',
  })
  baseFee: number;

  @Column('int', {
    name: 'remote_island_fee',
    nullable: false,
    default: 100,
    comment: '외섬 정상 배송비 (프로모션과 무관한 원래 요금)',
  })
  remoteIslandFee: number;

  @Column('boolean', {
    name: 'remote_island_promotion',
    nullable: false,
    default: false,
    comment: '프로모션 중이면 외섬에도 base_fee 적용',
  })
  remoteIslandPromotion: boolean;

  @Column('int', {
    name: 'free_shipping_threshold',
    nullable: false,
    default: 1150,
    comment: '상품 금액 합이 이 값 이상이면 배송비 0 (본섬·외섬 공통)',
  })
  freeShippingThreshold: number;

  @Column('boolean', {
    name: 'international_discount_enabled',
    nullable: false,
    default: false,
    comment:
      '국제배송비 지원 할인 ON/OFF. 손익 검증 전에는 꺼 둔다 (구간은 INTERNATIONAL_DISCOUNT_TIERS)',
  })
  internationalDiscountEnabled: boolean;

  /** 상품 금액에 해당하는 국제배송비 지원 할인액. 꺼져 있거나 첫 구간 미만이면 0 */
  calculateInternationalDiscount(productAmount: number): number {
    if (!this.internationalDiscountEnabled) {
      return 0;
    }

    const tier = [...INTERNATIONAL_DISCOUNT_TIERS]
      .reverse()
      .find((t) => productAmount >= t.threshold);

    return tier?.discount ?? 0;
  }

  /** 아직 못 받은 가장 가까운 다음 구간. 꺼져 있거나 마지막 구간이면 null */
  findNextDiscountTier(
    productAmount: number,
  ): { threshold: number; discount: number } | null {
    if (!this.internationalDiscountEnabled) {
      return null;
    }

    return (
      INTERNATIONAL_DISCOUNT_TIERS.find((t) => productAmount < t.threshold) ??
      null
    );
  }

  isFreeShipping(productAmount: number): boolean {
    return productAmount >= this.freeShippingThreshold;
  }

  /** 무료배송 판정을 통과하지 못했을 때 청구할 지역 요율 */
  getRegionFee(isRemoteIsland: boolean): number {
    if (isRemoteIsland && !this.remoteIslandPromotion) {
      return this.remoteIslandFee;
    }

    return this.baseFee;
  }

  /** 무료배송 판정이 지역 판정보다 앞선다 — 외섬도 임계금액을 넘으면 0 */
  calculateShippingFee(productAmount: number, isRemoteIsland: boolean): number {
    if (this.isFreeShipping(productAmount)) {
      return 0;
    }

    return this.getRegionFee(isRemoteIsland);
  }
}

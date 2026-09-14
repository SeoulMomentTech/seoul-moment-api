import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { CommonEntity } from './common.entity';

/**
 * 외섬(외지) 지역 판정 규칙.
 *
 * 澎湖縣·金門縣·連江縣 은 縣 전체가 외섬이라 district 가 null 이고,
 * 綠島鄉·蘭嶼鄉 은 臺東縣 소속이라 district 까지 지정해야 한다.
 * (같은 臺東縣이라도 臺東市는 본섬이다)
 *
 * 코드에 박지 않고 테이블로 두는 이유는 프로모션·지역 추가를 admin 에서
 * 처리하기 위해서다.
 */
@Entity('shipping_remote_area')
@Unique(['city', 'district'])
@Index(['city', 'isActive'])
// district IS NULL 인 행은 Postgres 에서 UNIQUE 충돌이 나지 않으므로
// "縣 전체" 규칙이 중복 등록되는 것을 부분 인덱스로 따로 막는다.
@Index('uq_shipping_remote_area_city_only', ['city'], {
  unique: true,
  where: '"district" IS NULL',
})
export class ShippingRemoteAreaEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', {
    length: 255,
    nullable: false,
    comment: '縣市',
  })
  city: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '區/鄉. null 이면 해당 city 전체가 외섬',
  })
  district: string | null;

  @Column('boolean', {
    name: 'is_active',
    nullable: false,
    default: true,
    comment: '판정에 사용할지 여부',
  })
  isActive: boolean;
}

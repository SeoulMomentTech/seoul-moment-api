import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { CustomsStatus } from '../enum/order.enum';

/**
 * 국제배송 묶음 (박스 1개). 여러 주문이 한 묶음에, 한 주문이 여러 묶음에 실릴 수 있어
 * 주문과는 shipment_order 로 잇는다. 운송장 번호와 수입신고번호는 서로 다른 번호다.
 * 수입자는 법인(首爾映像有限公司)으로 확정이라 개인 통관 정보는 받지 않는다.
 */
@Entity('shipment')
@Index(['intlTrackingNo'])
@Index(['importDeclarationNo'])
export class ShipmentEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', {
    name: 'intl_carrier',
    length: 50,
    nullable: true,
    comment: '국제운송사',
  })
  intlCarrier: string | null;

  @Column('varchar', {
    name: 'intl_tracking_no',
    length: 100,
    nullable: true,
    comment: '국제운송장 번호',
  })
  intlTrackingNo: string | null;

  @Column('varchar', {
    name: 'house_airwaybill_no',
    length: 100,
    nullable: true,
    comment: '분할운송장(HAWB) 번호',
  })
  houseAirwaybillNo: string | null;

  @Column('varchar', {
    name: 'import_declaration_no',
    length: 100,
    nullable: true,
    comment: '법인 수입신고번호. 운송장 번호와 다르다',
  })
  importDeclarationNo: string | null;

  @Column('enum', {
    name: 'customs_status',
    enum: CustomsStatus,
    default: CustomsStatus.WAITING,
    nullable: false,
    comment: '통관 상태. 배송 단계와 따로 관리한다',
  })
  customsStatus: CustomsStatus;

  @Column('timestamptz', {
    name: 'declared_at',
    nullable: true,
    comment: '수입신고 일시',
  })
  declaredAt: Date | null;

  @Column('timestamptz', {
    name: 'cleared_at',
    nullable: true,
    comment: '통관 완료 일시',
  })
  clearedAt: Date | null;

  @Column('varchar', {
    length: 1000,
    nullable: true,
    comment: '담당자 메모 (고객에게 노출하지 않는다)',
  })
  memo: string | null;

  @Column('int', {
    name: 'updated_by_admin_id',
    nullable: true,
    comment: '마지막으로 고친 관리자 ID',
  })
  updatedByAdminId: number | null;
}

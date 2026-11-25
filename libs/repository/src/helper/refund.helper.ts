import { RefundEntity } from '../entity/refund.entity';
import { RefundStatus } from '../enum/refund.enum';

/** 실제로 돌려준 합계. 끝나지 않은 환불은 세지 않는다 */
export function getRefundedAmount(refunds: RefundEntity[]): number {
  return refunds
    .filter((refund) => refund.status === RefundStatus.COMPLETED)
    .reduce((sum, refund) => sum + refund.amount, 0);
}

/** 끝나지 않은 환불. 주문당 하나뿐이다 (refund 의 부분 UNIQUE) */
export function getOpenRefund(refunds: RefundEntity[]): RefundEntity | null {
  return (
    refunds.find((refund) => refund.status !== RefundStatus.COMPLETED) ?? null
  );
}

import { RefundEntity } from '../entity/refund.entity';
import { RefundStatus } from '../enum/refund.enum';

/**
 * 결과를 모르는 요청을 다시 보내기 전에 기다리는 시간. 조회에 환불이 안 보여도 PG 가 아직
 * 처리 중일 수 있다 — 부분 금액은 PG 가 중복을 막아 주지 않아 두 번 나간다.
 */
const RESEND_WAIT_MS = 5 * 60 * 1000;

/** 방금 보낸 요청의 결과를 아직 모른다 — 조회에 없다고 바로 다시 보내지 않는다 */
export function isWaitingForPg(refund: RefundEntity, now: Date): boolean {
  return (
    refund.status === RefundStatus.PROCESSING &&
    !!refund.lastAttemptAt &&
    now.getTime() - refund.lastAttemptAt.getTime() < RESEND_WAIT_MS
  );
}

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

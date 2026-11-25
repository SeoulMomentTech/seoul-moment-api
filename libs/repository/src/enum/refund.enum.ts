/**
 * 환불 상태 (명세 v6 §8.3). PG 접수와 환불 완료를 한 상태로 합치지 않는다.
 */
export enum RefundStatus {
  /** 환불하기로 기록함. 수동 환불(ECPay)은 관리자가 완료를 입력할 때까지 여기 머문다 */
  REQUESTED = 'REQUESTED',
  /** PG 에 요청했지만 결과를 모른다 (타임아웃 등). 다시 시도하면 조회부터 한다 */
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  /** PG 가 거절했다. 사유를 보고 다시 시도하거나 수동으로 처리한다 */
  FAILED = 'FAILED',
}

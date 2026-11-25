import {
  EcpayCreditAction,
  EcpayCreditActionResultDto,
  EcpayCreditStatus,
  EcpayCreditTradeDto,
} from '@app/external/ecpay/ecpay.dto';
import { ExternalEcpayService } from '@app/external/ecpay/ecpay.service';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { RefundEntity } from '@app/repository/entity/refund.entity';
import { PaymentMethod } from '@app/repository/enum/order.enum';
import { PaymentEventSource } from '@app/repository/enum/payment.enum';
import { RefundStatus } from '@app/repository/enum/refund.enum';
import { isWaitingForPg } from '@app/repository/helper/refund.helper';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { RefundRepositoryService } from '@app/repository/service/refund.repository.service';
import { Injectable, Logger } from '@nestjs/common';

/**
 * PG 환불 한 번의 결과. 주문·재고·발표·알림은 RefundService 가 이 결과를 보고 처리한다.
 * - completed: 환불이 나갔다
 * - failed: PG 가 환불하지 않았다고 확정했다
 * - unknown: 보냈는데 결과를 모른다 — 다음 시도가 조회부터 한다
 * - held: 보내지 않았다 (조회 실패·매입 시간대). 환불 상태는 그대로 둔다
 */
export type PgRefundOutcome =
  | { kind: 'completed'; pgRefundId: string }
  | { kind: 'failed' | 'held'; code: string; message: string }
  | { kind: 'unknown'; message: string };

/**
 * 거래 상태별로 보낼 동작 (ECPay 문서의 退款使用方式 + 2026-11-25 stage 실측). 모르는 상태면 null.
 * - 매입 전(已授權·操作取消): 결제 전액이면 승인 취소(N). N 은 금액을 보지 않고 전부 취소하므로
 *   부분 환불에는 쓰지 않는다 — 먼저 매입을 요청(C)하고 退刷(R)한다
 * - 매입 요청됨(要關帳): 전액이면 매입 취소(E) 뒤 승인 취소(N), 부분이면 R
 * - 매입 완료(已關帳): R
 */
function planActions(
  status: string,
  isWholePayment: boolean,
): EcpayCreditAction[] | null {
  switch (status) {
    case EcpayCreditStatus.AUTHORIZED:
    case EcpayCreditStatus.CLOSE_CANCELED:
      return isWholePayment ? ['N'] : ['C', 'R'];
    case EcpayCreditStatus.CLOSING:
      return isWholePayment ? ['E', 'N'] : ['R'];
    case EcpayCreditStatus.CLOSED:
      return ['R'];
    default:
      return null;
  }
}

/**
 * ECPay 카드 결제의 환불 (請退款 DoAction).
 *
 * DoAction 은 멱등이 아니다 — 같은 退刷 를 두 번 보내면 두 번 환불된다. 그래서 매번 거래를
 * 조회해 (1) 상태에 맞는 동작을 고르고 (2) 이 환불을 보내기 전의 환불 합계를 적어 두었다가
 * (3) 결과를 모를 때는 합계가 늘었는지로 판단한다. ATM·편의점 결제는 환불 API 가 없다.
 */
@Injectable()
export class EcpayCardRefundService {
  private readonly logger = new Logger(EcpayCardRefundService.name);

  constructor(
    private readonly ecpayService: ExternalEcpayService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly refundRepositoryService: RefundRepositoryService,
  ) {}

  /** API 로 환불할 수 있는 결제인지 — 카드 결제 + 승인번호(gwsr) + 상점 검사 코드 */
  supports(payment: PaymentEntity): boolean {
    return (
      payment.method === PaymentMethod.ECPAY &&
      (payment.pgPaymentType ?? '').startsWith('Credit') &&
      !!payment.pgAuthId &&
      !!payment.pgTransactionId &&
      this.ecpayService.isCreditRefundEnabled()
    );
  }

  async refund(refund: RefundEntity): Promise<PgRefundOutcome> {
    const payment = await this.paymentRepositoryService.findById(
      refund.paymentId,
    );
    const trade = await this.ecpayService
      .queryCreditTrade(payment.pgAuthId, payment.amount)
      .catch((error) => {
        this.logger.error(`QueryTrade failed: ${error}`);

        return null;
      });

    // 거래 상태를 모르면 보내지 않는다 — 상태마다 보낼 동작이 다르고, 이미 나간 환불일 수 있다
    if (!trade?.isSuccess()) {
      return held('LOOKUP_FAILED', `not sent: ${trade?.rtnMsg ?? 'network'}`);
    }

    if (refund.attemptCount === 0) {
      refund.pgRefundedBefore = trade.refundedAmount;
      await this.refundRepositoryService.updateUnlessCompleted(refund.id, {
        pgRefundedBefore: trade.refundedAmount,
      });
    }

    const actions = planActions(trade.status, refund.amount === payment.amount);
    const stopped =
      this.settle(refund, payment, trade) ??
      this.findBlocker(refund, payment, trade);

    if (stopped) {
      return stopped;
    }

    return actions
      ? this.send(refund, payment, actions)
      : failed('UNEXPECTED_STATE', `card trade status: ${trade.status}`);
  }

  /** 앞선 시도가 이미 환불했는지. 이 환불을 보내기 전 합계에서 늘어난 만큼만 이 환불로 본다 */
  private settle(
    refund: RefundEntity,
    payment: PaymentEntity,
    trade: EcpayCreditTradeDto,
  ): PgRefundOutcome | null {
    const gained = trade.refundedAmount - (refund.pgRefundedBefore ?? 0);

    if (gained >= refund.amount) {
      return {
        kind: 'completed',
        pgRefundId: `lookup:${payment.pgTransactionId}`,
      };
    }

    if (gained > 0) {
      return failed(
        'PARTIALLY_REFUNDED',
        `NT$${gained} already refunded outside this system`,
      );
    }

    return isWaitingForPg(refund, new Date())
      ? { kind: 'unknown', message: 'not found by lookup yet. Retry later' }
      : null;
  }

  private findBlocker(
    refund: RefundEntity,
    payment: PaymentEntity,
    trade: EcpayCreditTradeDto,
  ): PgRefundOutcome | null {
    if (payment.amount - trade.refundedAmount < refund.amount) {
      return failed(
        'ALREADY_REFUNDED',
        `NT$${trade.refundedAmount} of NT$${payment.amount} is already refunded at ECPay`,
      );
    }

    return this.ecpayService.isCreditClosingWindow()
      ? held(
          'CLOSING_WINDOW',
          'not sent: ECPay closes card trades 20:15-20:30 (Taipei). Retry after 20:35',
        )
      : null;
  }

  /** 요청 횟수를 먼저 저장하고 부른다 — 응답을 못 받아도 다음 시도가 조회부터 한다 */
  private async send(
    refund: RefundEntity,
    payment: PaymentEntity,
    actions: EcpayCreditAction[],
  ): Promise<PgRefundOutcome> {
    await this.refundRepositoryService.updateUnlessCompleted(refund.id, {
      attemptCount: refund.attemptCount + 1,
      status: RefundStatus.PROCESSING,
      lastAttemptAt: new Date(),
    });

    const queue = [...actions];
    const done: EcpayCreditAction[] = [];

    while (queue.length > 0) {
      const action = queue.shift();
      const result = await this.act(
        payment,
        action,
        action === 'R' ? refund.amount : payment.amount,
      );

      // 응답이 없거나 코드가 없으면(점검 페이지 등) 나갔는지 모른다 — 실패로 닫지 않는다
      if (!result?.rtnCode) {
        return { kind: 'unknown', message: `${action}: no readable response` };
      }

      if (result.isSuccess()) {
        done.push(action);
      } else if (action === 'E') {
        // 자동 매입된 거래는 다음 날 06:00 전에 매입 취소가 안 된다 — 매입 금액에서 전액 退刷 한다
        queue.splice(0, queue.length, 'R');
      } else {
        return failed(
          result.rtnCode,
          `${action}: ${result.rtnMsg}${done.length ? ` (done: ${done.join('+')} — retry to finish)` : ''}`,
        );
      }
    }

    return {
      kind: 'completed',
      pgRefundId: `${done.join('+')}:${payment.pgTransactionId}`,
    };
  }

  /** 응답을 못 받았으면(타임아웃·기록 실패) null — 나갔는지 모르는 것으로 다룬다 */
  private async act(
    payment: PaymentEntity,
    action: EcpayCreditAction,
    amount: number,
  ): Promise<EcpayCreditActionResultDto | null> {
    try {
      const result = await this.ecpayService.doCreditAction(
        payment.merchantTradeNo,
        payment.pgTransactionId,
        action,
        amount,
      );

      await this.paymentRepositoryService.saveEvent(
        payment.id,
        PaymentEventSource.ECPAY_REFUND,
        { Action: action, TotalAmount: amount, ...result.raw },
      );

      return result;
    } catch (error) {
      this.logger.error(
        `DoAction ${action} failed: paymentId=${payment.id} ${error}`,
      );

      return null;
    }
  }
}

function failed(code: string, message: string): PgRefundOutcome {
  return { kind: 'failed', code, message };
}

function held(code: string, message: string): PgRefundOutcome {
  return { kind: 'held', code, message };
}

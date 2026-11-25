import { ExternalGoogleMailService } from '@app/external/google/google-mail.service';
import { RefundEntity } from '@app/repository/entity/refund.entity';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { Injectable, Logger } from '@nestjs/common';

const SENDER = 'SEOUL MOMENT';

/**
 * 환불 완료 알림 메일 (환불 규정 5).
 *
 * shortcut: 실패한 메일은 다시 보내지 않고 로그만 남긴다 — 환불 자체는 이미 끝났고 고객은
 * 주문 상세에서 볼 수 있다. 알림 누락이 문제가 되면 발송 이력 테이블과 재시도를 붙인다.
 */
@Injectable()
export class RefundNoticeService {
  private readonly logger = new Logger(RefundNoticeService.name);

  constructor(
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly userRepositoryService: UserRepositoryService,
    private readonly mailService: ExternalGoogleMailService,
  ) {}

  /** 던지지 않는다 — 메일이 실패해도 환불 응답은 성공이어야 한다 */
  async notifyCompleted(refund: RefundEntity): Promise<void> {
    try {
      const order = await this.orderRepositoryService.findById(refund.orderId);
      const user = order
        ? await this.userRepositoryService.findUserById(order.userId)
        : null;

      if (!user?.email) {
        return;
      }

      await this.mailService.sendMail(
        user.email,
        SENDER,
        `[SEOUL MOMENT] 退款完成通知 (訂單 ${order.orderNumber})`,
        buildRefundMail(order.orderNumber, refund.amount, order.totalAmount),
      );
    } catch (error) {
      this.logger.error(
        `refund notice failed: orderId=${refund.orderId} refundId=${refund.id} ${error}`,
      );
    }
  }
}

export function buildRefundMail(
  orderNumber: string,
  amount: number,
  orderTotal: number,
): string {
  const kind = amount < orderTotal ? '部分退款' : '全額退款';

  return [
    '<p>您好，</p>',
    `<p>訂單 <b>${orderNumber}</b> 的退款已完成。</p>`,
    '<ul>',
    `<li>退款金額：NT$${amount.toLocaleString('en-US')} (${kind})</li>`,
    '<li>退款方式：原付款方式或銀行轉帳</li>',
    '</ul>',
    '<p>實際入帳時間依付款機構而定，信用卡退款可能需要 7–14 個工作天。</p>',
    '<p>如有任何問題，請與客服聯繫。</p>',
    '<p>SEOUL MOMENT</p>',
  ].join('');
}

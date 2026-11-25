import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { InvoiceAdjustStatus } from '@app/repository/enum/invoice.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { RefundRepositoryService } from '@app/repository/service/refund.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetAdminInvoiceAdjustmentResponse,
  GetAdminRefundListItemResponse,
  GetAdminRefundListRequest,
} from './admin.refund.dto';
import { InvoiceAdjustService } from '../../invoice/invoice-adjust.service';

const RETRYABLE = [InvoiceAdjustStatus.PENDING, InvoiceAdjustStatus.FAILED];

@Injectable()
export class AdminRefundService {
  constructor(
    private readonly refundRepositoryService: RefundRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly invoiceAdjustService: InvoiceAdjustService,
  ) {}

  async getList(
    query: GetAdminRefundListRequest,
  ): Promise<[GetAdminRefundListItemResponse[], number]> {
    const [refunds, total] = await this.refundRepositoryService.findPage(
      query.status,
      (query.page - 1) * query.count,
      query.count,
    );
    const orderIds = refunds.map((refund) => refund.orderId);
    const [orders, invoices] = await Promise.all([
      orderIds.length ? this.orderRepositoryService.findByIds(orderIds) : [],
      this.orderRepositoryService.findInvoicesByOrderIds(orderIds),
    ]);

    return [
      refunds.map((refund) =>
        GetAdminRefundListItemResponse.of(
          refund,
          orders.find((order) => order.id === refund.orderId),
          invoices.find((invoice) => invoice.orderId === refund.orderId),
        ),
      ),
      total,
    ];
  }

  /** 발표 정정만 다시 시도한다. 환불은 건드리지 않는다 */
  async retryInvoiceAdjust(
    orderId: number,
  ): Promise<GetAdminInvoiceAdjustmentResponse> {
    const invoice =
      await this.orderRepositoryService.findInvoiceByOrderId(orderId);

    if (!invoice) {
      throw new ServiceError(
        `Order ${orderId} has no invoice`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    if (!RETRYABLE.includes(invoice.adjustStatus)) {
      throw new ServiceError(
        `Invoice of order ${orderId} has nothing to adjust (adjustStatus=${invoice.adjustStatus})`,
        ServiceErrorCode.CONFLICT,
      );
    }

    const adjusted = await this.invoiceAdjustService.adjustForOrder(orderId);

    if (!adjusted) {
      throw new ServiceError(
        `Invoice of order ${orderId} is being processed. Try again shortly`,
        ServiceErrorCode.CONFLICT,
      );
    }

    return GetAdminInvoiceAdjustmentResponse.from(adjusted);
  }
}

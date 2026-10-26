import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';

import { PaymentEventEntity } from '../entity/payment-event.entity';
import { PaymentEntity } from '../entity/payment.entity';
import { PaymentMethod } from '../enum/order.enum';
import {
  ACTIVE_PAYMENT_STATUSES,
  PaymentEventSource,
  PaymentStatus,
} from '../enum/payment.enum';

/** 배치가 한 번에 집는 건수. PG 조회 API 를 연달아 부르므로 작게 둔다 */
const BATCH_LIMIT = 50;

@Injectable()
export class PaymentRepositoryService {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(PaymentEventEntity)
    private readonly paymentEventRepository: Repository<PaymentEventEntity>,
  ) {}

  async save(entity: PaymentEntity): Promise<PaymentEntity> {
    return this.paymentRepository.save(entity);
  }

  /** 거래번호는 id 로 만들므로 INSERT 이후에야 확정된다 (같은 트랜잭션 안) */
  async updateMerchantTradeNo(id: number, merchantTradeNo: string) {
    return this.paymentRepository.update({ id }, { merchantTradeNo });
  }

  async findById(id: number): Promise<PaymentEntity | null> {
    return this.paymentRepository.findOneBy({ id });
  }

  /** 트랜잭션 안에서만 부른다. 콜백 재전송·동시 도착을 한 줄로 세운다 */
  async findByIdForUpdate(id: number): Promise<PaymentEntity | null> {
    return this.paymentRepository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async findByMerchantTradeNo(
    merchantTradeNo: string,
  ): Promise<PaymentEntity | null> {
    if (!merchantTradeNo) {
      return null;
    }

    return this.paymentRepository.findOneBy({ merchantTradeNo });
  }

  async findByAccessToken(accessToken: string): Promise<PaymentEntity | null> {
    if (!accessToken) {
      return null;
    }

    return this.paymentRepository.findOneBy({ accessToken });
  }

  async findLatestByOrderId(orderId: number): Promise<PaymentEntity | null> {
    return this.paymentRepository.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });
  }

  async findActiveByOrderId(orderId: number): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: { orderId, status: In(ACTIVE_PAYMENT_STATUSES) },
      order: { id: 'ASC' },
    });
  }

  async countActiveByOrderIdExcept(
    orderId: number,
    exceptPaymentId: number,
  ): Promise<number> {
    return this.paymentRepository.count({
      where: {
        orderId,
        id: Not(exceptPaymentId),
        status: In(ACTIVE_PAYMENT_STATUSES),
      },
    });
  }

  /**
   * 결제창(handoff)을 한 번만 열게 한다. 조건부 UPDATE 라 동시에 두 번 열어도
   * 한쪽만 true 를 받는다.
   */
  async markHandoffOpened(id: number): Promise<boolean> {
    const result = await this.paymentRepository.update(
      { id, handoffOpenedAt: IsNull() },
      { handoffOpenedAt: new Date() },
    );

    return (result.affected ?? 0) === 1;
  }

  /**
   * LINE Pay 요청이 성공했을 때 READY → REQUESTED. 그 사이 다른 탭이 새 시도를 시작해
   * 이 시도가 취소됐다면 0행이라 false — 취소된 시도를 되살리지 않는다.
   */
  async markRequested(id: number, pgTransactionId: string): Promise<boolean> {
    const result = await this.paymentRepository.update(
      { id, status: PaymentStatus.READY },
      {
        status: PaymentStatus.REQUESTED,
        requestedAt: new Date(),
        pgTransactionId,
      },
    );

    return (result.affected ?? 0) === 1;
  }

  /** PG 로 넘기지 못한 채 남은 시도 (요청 중 프로세스가 죽은 경우 등) */
  async findStaleReady(createdBefore: Date): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: {
        status: PaymentStatus.READY,
        requestedAt: LessThan(createdBefore),
      },
      order: { id: 'ASC' },
      take: BATCH_LIMIT,
    });
  }

  async findStaleRequested(
    method: PaymentMethod,
    requestedBefore: Date,
  ): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: {
        method,
        status: PaymentStatus.REQUESTED,
        requestedAt: LessThan(requestedBefore),
      },
      order: { id: 'ASC' },
      take: BATCH_LIMIT,
    });
  }

  async findExpiredWaitingDeposit(now: Date): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: {
        status: PaymentStatus.WAITING_DEPOSIT,
        expireAt: LessThan(now),
      },
      order: { id: 'ASC' },
      take: BATCH_LIMIT,
    });
  }

  async saveEvent(
    paymentId: number | null,
    source: PaymentEventSource,
    payload: Record<string, unknown>,
    note?: string,
  ): Promise<PaymentEventEntity> {
    return this.paymentEventRepository.save(
      this.paymentEventRepository.create({
        paymentId,
        source,
        payload,
        note: note ? note.slice(0, 255) : null,
      }),
    );
  }
}

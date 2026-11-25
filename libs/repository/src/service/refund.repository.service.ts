import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { RefundEntity } from '../entity/refund.entity';
import { RefundStatus } from '../enum/refund.enum';

@Injectable()
export class RefundRepositoryService {
  constructor(
    @InjectRepository(RefundEntity)
    private readonly refundRepository: Repository<RefundEntity>,
  ) {}

  async findByOrderId(orderId: number): Promise<RefundEntity | null> {
    return this.refundRepository.findOneBy({ orderId });
  }

  async save(entity: RefundEntity): Promise<RefundEntity> {
    return this.refundRepository.save(entity);
  }

  /**
   * 완료 처리는 한 번만 된다. 조건부 UPDATE 라 동시에 두 곳에서 완료를 확인해도
   * 한쪽만 true 를 받아 재고 복구·주문 취소가 두 번 돌지 않는다.
   */
  async markCompleted(
    id: number,
    pgRefundId: string | null,
    completedAt: Date,
  ): Promise<boolean> {
    const result = await this.refundRepository.update(
      { id, status: Not(RefundStatus.COMPLETED) },
      {
        status: RefundStatus.COMPLETED,
        pgRefundId,
        completedAt,
        failureCode: null,
        failureMessage: null,
      },
    );

    return (result.affected ?? 0) === 1;
  }

  /** 완료된 환불은 건드리지 않는다. 늦게 끝난 요청이 COMPLETED 를 되돌리지 못한다 */
  async updateUnlessCompleted(
    id: number,
    fields: Partial<
      Pick<
        RefundEntity,
        'status' | 'attemptCount' | 'failureCode' | 'failureMessage'
      >
    >,
  ) {
    return this.refundRepository.update(
      { id, status: Not(RefundStatus.COMPLETED) },
      fields,
    );
  }

  async findPage(
    status: RefundStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[RefundEntity[], number]> {
    return this.refundRepository.findAndCount({
      where: status ? { status } : {},
      order: { id: 'DESC' },
      skip,
      take,
    });
  }
}

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

  /** 한 주문의 환불 전부 (오래된 순). 부분 환불이 있으면 여러 건이다 */
  async findAllByOrderId(orderId: number): Promise<RefundEntity[]> {
    return this.refundRepository.find({
      where: { orderId },
      order: { id: 'ASC' },
    });
  }

  async findById(id: number): Promise<RefundEntity | null> {
    return this.refundRepository.findOneBy({ id });
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
        | 'status'
        | 'attemptCount'
        | 'failureCode'
        | 'failureMessage'
        | 'amount'
        | 'isManual'
        | 'pgRefundedBefore'
        | 'lastAttemptAt'
      >
    >,
  ) {
    return this.refundRepository.update(
      { id, status: Not(RefundStatus.COMPLETED) },
      fields,
    );
  }

  /** 끝나지 않은 환불을 없던 일로 한다. 완료된 환불은 지우지 않는다. 지웠으면 true */
  async deleteOpen(id: number): Promise<boolean> {
    // 소프트 삭제가 아니다 — 남아 있으면 "끝나지 않은 환불은 주문당 하나" 인덱스에 걸린다
    const result = await this.refundRepository.delete({
      id,
      status: Not(RefundStatus.COMPLETED),
    });

    return (result.affected ?? 0) === 1;
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

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

/**
 * 재고 선점 · 복구.
 *
 * 결제 시작 때 잡고, 시도가 끝나면(실패·취소·만료) 돌려준다. ATM·편의점 입금 대기
 * 동안에도 잡아 둔다. 取號 시점에 잡으면 그 사이 품절됐을 때 이미 발급된 계좌를
 * 되돌릴 수 없어서다.
 *
 * order.stock_reserved 를 같은 트랜잭션에서 바꿔 두 번 차감·두 번 복구를 막는다.
 */
@Injectable()
export class StockReservationService {
  constructor(
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  /**
   * 하나라도 모자라면 이미 줄인 라인을 되돌린 뒤 CONFLICT 를 던진다.
   * 롤백에 기대지 않고 직접 되돌리는 이유: 호출한 쪽(markPaid)이 이 예외를 잡고
   * 같은 트랜잭션을 이어 가기 때문이다. typeorm-transactional 0.5 의 NESTED 는
   * savepoint 가 아니라 새 커넥션의 새 트랜잭션이라, 바깥이 잠근 주문 행을 기다리며
   * 교착이 난다 — 쓰지 않는다.
   */
  @Transactional()
  async reserve(order: OrderEntity): Promise<void> {
    if (order.stockReserved) {
      return;
    }

    const items = await this.loadItemsInLockOrder(order.id);
    const decreased: OrderItemEntity[] = [];
    const unavailable: number[] = [];

    for (const item of items) {
      const reserved =
        item.productVariantId !== null &&
        (await this.productRepositoryService.decreaseStock(
          item.productVariantId,
          item.quantity,
        ));

      if (reserved) {
        decreased.push(item);
      } else {
        unavailable.push(item.productVariantId ?? 0);
      }
    }

    if (unavailable.length > 0) {
      await this.increase(decreased);

      throw new ServiceError(
        `Some items are out of stock: productVariantIds=${unavailable.join(', ')}`,
        ServiceErrorCode.CONFLICT,
        { productVariantIds: unavailable },
      );
    }

    await this.orderRepositoryService.updateOrder(order.id, {
      stockReserved: true,
    });
    order.stockReserved = true;
  }

  /** 재고를 잡고 있었다면 돌려준다 */
  @Transactional()
  async release(order: OrderEntity): Promise<void> {
    if (!order.stockReserved) {
      return;
    }

    await this.increase(await this.loadItemsInLockOrder(order.id));

    await this.orderRepositoryService.updateOrder(order.id, {
      stockReserved: false,
    });
    order.stockReserved = false;
  }

  /** 잡아 보고 모자라면 false. 결제가 이미 끝난 뒤(늦은 통지)에 쓴다 */
  async tryReserve(order: OrderEntity): Promise<boolean> {
    try {
      await this.reserve(order);

      return true;
    } catch (error) {
      if (
        error instanceof ServiceError &&
        error.getCode() === ServiceErrorCode.CONFLICT
      ) {
        return false;
      }

      throw error;
    }
  }

  /** 상품이 삭제돼 SKU 가 없는 라인은 건너뛴다 */
  private async increase(items: OrderItemEntity[]) {
    for (const item of items) {
      if (item.productVariantId !== null) {
        await this.productRepositoryService.increaseStock(
          item.productVariantId,
          item.quantity,
        );
      }
    }
  }

  /**
   * 여러 주문이 같은 SKU 들을 동시에 잡을 때 교착을 피하려고 항상 SKU id 순서로 잠근다.
   */
  private async loadItemsInLockOrder(
    orderId: number,
  ): Promise<OrderItemEntity[]> {
    const items = await this.orderRepositoryService.findItemsByOrderId(orderId);

    return items.sort(
      (a, b) => (a.productVariantId ?? 0) - (b.productVariantId ?? 0),
    );
  }
}

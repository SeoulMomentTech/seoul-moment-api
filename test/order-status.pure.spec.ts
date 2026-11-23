import { OrderEntity } from '@app/repository/entity/order.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  FulfillmentTimerState,
  OrderStatus,
  PurchaseStatus,
} from '@app/repository/enum/order.enum';
import {
  getTimerState,
  getTimerStateLabel,
} from '@app/repository/helper/order-status.helper';

/** 24시간 타이머 순수 함수. 시각을 고정해 경계를 정확히 본다 */
describe('주문 24시간 타이머', () => {
  const paidAt = new Date('2026-11-23T00:00:00.000Z');
  const at = (ms: number) => new Date(paidAt.getTime() + ms);
  const HOUR = 3600_000;
  const base = {
    status: OrderStatus.PAID,
    paidAt,
    purchaseStatus: PurchaseStatus.NOT_ORDERED,
    cancellationRequestedAt: null,
  } as Pick<
    OrderEntity,
    'status' | 'paidAt' | 'purchaseStatus' | 'cancellationRequestedAt'
  >;

  it.each([
    [0, FulfillmentTimerState.WAITING],
    [20 * HOUR + 59_999, FulfillmentTimerState.WAITING],
    [21 * HOUR, FulfillmentTimerState.SOON],
    [24 * HOUR - 1000, FulfillmentTimerState.SOON],
    [24 * HOUR, FulfillmentTimerState.READY],
    [48 * HOUR, FulfillmentTimerState.READY],
  ])('결제 후 %i ms 는 %s', (elapsed, expected) => {
    expect(getTimerState(base, at(elapsed))).toBe(expected);
  });

  it('결제 전이거나 paidAt 이 없으면 타이머가 시작되지 않는다', () => {
    expect(
      getTimerState({ ...base, status: OrderStatus.PENDING }, at(48 * HOUR)),
    ).toBe(FulfillmentTimerState.NOT_PAID);
    expect(getTimerState({ ...base, paidAt: null }, at(48 * HOUR))).toBe(
      FulfillmentTimerState.NOT_PAID,
    );
  });

  it('발주 완료·취소 접수는 24시간과 무관하게 우선한다', () => {
    expect(
      getTimerState(
        { ...base, purchaseStatus: PurchaseStatus.ORDERED },
        at(48 * HOUR),
      ),
    ).toBe(FulfillmentTimerState.ORDERED);
    expect(
      getTimerState(
        { ...base, cancellationRequestedAt: new Date() },
        at(48 * HOUR),
      ),
    ).toBe(FulfillmentTimerState.CANCEL_REQUESTED);
  });

  it('문구는 언어별로 나오고, 모르는 언어는 한국어로 돌아간다', () => {
    expect(
      getTimerStateLabel(FulfillmentTimerState.READY, LanguageCode.TAIWAN),
    ).toBe('已滿24小時・可下單');
    expect(getTimerStateLabel(FulfillmentTimerState.READY, undefined)).toBe(
      '24시간 경과 · 발주 가능',
    );
  });
});

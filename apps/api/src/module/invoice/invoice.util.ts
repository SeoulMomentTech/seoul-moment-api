import {
  EcpayInvoiceIssueData,
  EcpayInvoiceItem,
} from '@app/external/ecpay/ecpay-invoice.dto';
import { OrderInvoiceEntity } from '@app/repository/entity/order-invoice.entity';
import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { InvoiceType } from '@app/repository/enum/invoice.enum';

export const MOBILE_BARCODE_PATTERN = /^\/[0-9A-Z+\-.]{7}$/;
export const CITIZEN_CERT_PATTERN = /^[A-Z]{2}\d{14}$/;
export const LOVE_CODE_PATTERN = /^\d{3,7}$/;

/** ECPay 문서 기준 길이 제한 */
const ITEM_NAME_MAX = 500;
const ITEM_WORD_MAX = 6;

const CARRIER_TYPE: Record<InvoiceType, EcpayInvoiceIssueData['CarrierType']> =
  {
    [InvoiceType.MEMBER_CARRIER]: '1',
    [InvoiceType.COMPANY]: '1',
    [InvoiceType.CITIZEN_CERT]: '2',
    [InvoiceType.MOBILE_BARCODE]: '3',
    [InvoiceType.DONATION]: '',
  };

/**
 * 統一編號 검사코드. 가중치 1,2,1,2,1,2,4,1 을 곱한 각 자리수의 합이 5 의 배수여야 한다.
 * 7번째 자리가 7 이면 그 항(28 → 10)을 0 또는 1 로 셀 수 있어 합 + 1 도 허용한다.
 * (재정부 2023 개정: 10 의 배수 → 5 의 배수)
 */
export function isValidTaxId(taxId: string): boolean {
  if (!/^\d{8}$/.test(taxId)) {
    return false;
  }

  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  const sum = taxId
    .split('')
    .map((digit, i) => Number(digit) * weights[i])
    .reduce(
      (acc, product) => acc + Math.floor(product / 10) + (product % 10),
      0,
    );

  return sum % 5 === 0 || (taxId[6] === '7' && (sum + 1) % 5 === 0);
}

/** '+886 912 345 678' · '0912-345-678' → '0912345678'. ECPay CustomerPhone 은 숫자만 받는다 */
export function normalizeTaiwanPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');

  if (digits.startsWith('886')) {
    return `0${digits.slice(3)}`.slice(0, 20);
  }

  return digits.slice(0, 20);
}

/**
 * 발표 RelateNumber. 영숫자만(특수기호 금지, 대소문자 같은 값), 50자 이하, 재사용 불가.
 * - 운영: 접두사 + 'INV' + order.id 12자리
 * - 그 밖: ECPay 공개 테스트 상점은 남과 같이 쓰므로 시각을 섞는다
 */
export function buildRelateNumber(
  prefix: string,
  orderId: number,
  isProd: boolean,
  now: number = Date.now(),
): string {
  const safePrefix = prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'SM';
  const id = String(orderId).padStart(12, '0');

  if (isProd) {
    return `${safePrefix}INV${id}`;
  }

  return `${safePrefix}INV${now.toString(36).toUpperCase()}${id}`;
}

/**
 * B2C 발표 Data. 필드 조합 규칙 (stage 실측 포함):
 * - Print 는 항상 0 (종이 발표를 직접 출력·우송하지 않는다)
 * - 統編(COMPANY)은 ECPay 회원 載具(1)에 담는다 — 統編 + Print 0 + 載具 없음은 거절된다
 * - 기부는 載具를 비우고 Donation=1 + LoveCode
 * - 이메일·전화번호 중 하나는 반드시 있어야 한다
 * - B2C 는 세금 포함 가격(vat=1). ItemAmount 합 = SalesAmount
 */
export function buildIssueData(
  order: OrderEntity,
  items: OrderItemEntity[],
  invoice: OrderInvoiceEntity,
  relateNumber: string,
): EcpayInvoiceIssueData {
  const isCompany = invoice.type === InvoiceType.COMPANY;
  const isDonation = invoice.type === InvoiceType.DONATION;
  const usesCarrierNum =
    invoice.type === InvoiceType.MOBILE_BARCODE ||
    invoice.type === InvoiceType.CITIZEN_CERT;

  return {
    RelateNumber: relateNumber,
    CustomerID: '',
    CustomerIdentifier: isCompany ? (invoice.companyTaxId ?? '') : '',
    CustomerName: isCompany ? (invoice.companyName ?? '') : '',
    CustomerAddr: '',
    CustomerPhone: invoice.customerPhone ?? '',
    CustomerEmail: invoice.customerEmail ?? '',
    ClearanceMark: '',
    Print: '0',
    Donation: isDonation ? '1' : '0',
    LoveCode: isDonation ? (invoice.loveCode ?? '') : '',
    CarrierType: CARRIER_TYPE[invoice.type],
    CarrierNum: usesCarrierNum ? (invoice.carrierNum ?? '') : '',
    TaxType: '1',
    SalesAmount: order.totalAmount,
    InvoiceRemark: `訂單編號 ${order.orderNumber}`,
    InvType: '07',
    vat: '1',
    Items: buildItems(order, items),
  };
}

function buildItems(
  order: OrderEntity,
  items: OrderItemEntity[],
): EcpayInvoiceItem[] {
  const lines: Omit<EcpayInvoiceItem, 'ItemSeq'>[] = items.map((item) => ({
    ItemName: truncate(
      [item.productNameSnapshot, item.optionTextSnapshot]
        .filter(Boolean)
        .join(' / ') || 'Item',
      ITEM_NAME_MAX,
    ),
    ItemCount: item.quantity,
    ItemWord: '件'.slice(0, ITEM_WORD_MAX),
    ItemPrice: item.unitDiscountPrice,
    ItemAmount: item.totalPrice,
  }));

  if (order.shippingFeeApplied > 0) {
    lines.push({
      ItemName: '運費',
      ItemCount: 1,
      ItemWord: '式',
      ItemPrice: order.shippingFeeApplied,
      ItemAmount: order.shippingFeeApplied,
    });
  }

  return lines.map((line, i) => ({ ItemSeq: i + 1, ...line }));
}

function truncate(value: string, max: number): string {
  const chars = Array.from(value);

  return chars.length <= max ? value : chars.slice(0, max).join('');
}

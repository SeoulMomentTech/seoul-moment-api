import {
  decryptEcpayData,
  encryptEcpayData,
} from '@app/external/ecpay/ecpay.aes';
import { OrderInvoiceEntity } from '@app/repository/entity/order-invoice.entity';
import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { InvoiceType } from '@app/repository/enum/invoice.enum';
import { plainToInstance } from 'class-transformer';

import {
  buildAllowanceData,
  buildIssueData,
  buildRelateNumber,
  getVoidDeadline,
  isValidTaxId,
  normalizeTaiwanPhone,
  toTaipeiDate,
} from '../apps/api/src/module/invoice/invoice.util';

/** 전자발표 순수 함수. 앱·DB 없이 돈다 */
describe('전자발표 순수 함수', () => {
  describe('ECPay AES (developers.ecpay.com.tw/7958 예제)', () => {
    const KEY = 'ejCk326UnaZWKisg';
    const IV = 'q9jcZX8Ib9LM8wYk';

    it('문서 예제와 같은 암호문을 만든다', () => {
      expect(
        encryptEcpayData({ Name: 'Test', ID: 'A123456789' }, KEY, IV),
      ).toBe(
        'uvI4yrErM37XNQkXGAgRgJAgHn2t72jahaMZzYhWL1HmvH4WV18VJDP2i9pTbC+tby5nxVExLLFyAkbjbS2Dvg==',
      );
    });

    it('중문·공백·+ 가 섞여도 되돌리면 원문이다', () => {
      // Given
      const data = { CarrierNum: '/AB+1234', ItemName: '運費 x 1', n: 1 };

      // When
      const round = decryptEcpayData(encryptEcpayData(data, KEY, IV), KEY, IV);

      // Then
      expect(round).toEqual(data);
    });
  });

  describe('統一編號 검사코드', () => {
    it.each(['97025978', '53538851', '04595257'])('%s 는 맞다', (taxId) => {
      expect(isValidTaxId(taxId)).toBe(true);
    });

    it.each(['12345678', '1234567', 'abcdefgh', ''])(
      '%s 는 틀리다',
      (taxId) => {
        expect(isValidTaxId(taxId)).toBe(false);
      },
    );
  });

  describe('전화번호', () => {
    it('국제번호·공백·하이픈을 지우고 09 로 시작하게 바꾼다', () => {
      expect(normalizeTaiwanPhone('+886 912 345 678')).toBe('0912345678');
      expect(normalizeTaiwanPhone('0912-345-678')).toBe('0912345678');
      expect(normalizeTaiwanPhone(null)).toBe('');
    });
  });

  describe('RelateNumber', () => {
    it('영숫자만, 50자 이하', () => {
      expect(buildRelateNumber('SM', 481, true)).toBe('SMINV000000000481');
      expect(buildRelateNumber('S-D', 481, false, 1_700_000_000_000)).toMatch(
        /^[A-Za-z0-9]{1,50}$/,
      );
    });
  });

  describe('발행 데이터 조합', () => {
    const order = plainToInstance(OrderEntity, {
      id: 1,
      orderNumber: 'SM-20261026-000001',
      totalAmount: 2060,
      shippingFeeApplied: 60,
    });
    const items = [
      plainToInstance(OrderItemEntity, {
        productNameSnapshot: '셔츠',
        optionTextSnapshot: 'IVORY / M',
        quantity: 2,
        unitDiscountPrice: 1000,
        totalPrice: 2000,
      }),
    ];

    function invoiceOf(fields: Partial<OrderInvoiceEntity>) {
      return plainToInstance(OrderInvoiceEntity, {
        customerEmail: 'buyer@example.com',
        customerPhone: '0912345678',
        ...fields,
      });
    }

    it('ItemAmount 합이 SalesAmount 와 같고 배송비는 별도 줄이다', () => {
      // When
      const data = buildIssueData(
        order,
        items,
        invoiceOf({ type: InvoiceType.MEMBER_CARRIER }),
        'R1',
      );

      // Then
      expect(data.SalesAmount).toBe(2060);
      expect(data.Items.reduce((sum, item) => sum + item.ItemAmount, 0)).toBe(
        2060,
      );
      expect(data.Items.map((item) => item.ItemSeq)).toEqual([1, 2]);
      expect(data.Items[1]).toMatchObject({ ItemName: '運費', ItemAmount: 60 });
      expect(data).toMatchObject({
        Print: '0',
        TaxType: '1',
        InvType: '07',
        vat: '1',
      });
    });

    it('국제배송비 지원 할인은 음수 라인으로 들어가 ItemAmount 합이 SalesAmount 와 같다', () => {
      // Given - 상품 4000 - 할인 120 = 3880
      const discounted = plainToInstance(OrderEntity, {
        id: 2,
        orderNumber: 'SM-20261026-000002',
        totalAmount: 3880,
        shippingFeeApplied: 0,
        internationalDiscount: 120,
      });
      const lines = [
        plainToInstance(OrderItemEntity, {
          productNameSnapshot: '셔츠',
          quantity: 1,
          unitDiscountPrice: 4000,
          totalPrice: 4000,
        }),
      ];

      // When
      const data = buildIssueData(
        discounted,
        lines,
        invoiceOf({ type: InvoiceType.MEMBER_CARRIER }),
        'R1',
      );

      // Then
      expect(data.SalesAmount).toBe(3880);
      expect(data.Items.reduce((sum, item) => sum + item.ItemAmount, 0)).toBe(
        3880,
      );
      expect(data.Items[1]).toMatchObject({ ItemAmount: -120 });
    });

    it.each([
      [
        InvoiceType.MEMBER_CARRIER,
        {},
        { CarrierType: '1', CarrierNum: '', Donation: '0' },
      ],
      [
        InvoiceType.MOBILE_BARCODE,
        { carrierNum: '/ABC1234' },
        { CarrierType: '3', CarrierNum: '/ABC1234' },
      ],
      [
        InvoiceType.CITIZEN_CERT,
        { carrierNum: 'AB12345678901234' },
        { CarrierType: '2', CarrierNum: 'AB12345678901234' },
      ],
      [
        InvoiceType.DONATION,
        { loveCode: '168001' },
        { CarrierType: '', Donation: '1', LoveCode: '168001' },
      ],
      [
        InvoiceType.COMPANY,
        { companyTaxId: '97025978', companyName: '首爾映像有限公司' },
        {
          CarrierType: '1',
          CustomerIdentifier: '97025978',
          CustomerName: '首爾映像有限公司',
          Donation: '0',
        },
      ],
    ])('%s 는 ECPay 가 받는 필드 조합으로 보낸다', (type, fields, expected) => {
      // When
      const data = buildIssueData(
        order,
        items,
        invoiceOf({ type, ...fields }),
        'R1',
      );

      // Then
      expect(data).toMatchObject(expected);
      expect(data.Print).toBe('0');
      expect(data.CustomerEmail || data.CustomerPhone).toBeTruthy();
    });
  });

  describe('作廢 기한 · 折讓 데이터', () => {
    it.each([
      // [발행 시각(UTC), 作廢 마감(UTC)] — 마감은 대만 13일 23:59:59
      ['2026-11-25T02:00:00Z', '2027-01-13T15:59:59.000Z'],
      ['2026-12-31T15:59:59Z', '2027-01-13T15:59:59.000Z'],
      // UTC 로는 12월이지만 대만은 이미 1월 1일 — 1–2월 기간이다
      ['2026-12-31T16:30:00Z', '2027-03-13T15:59:59.000Z'],
      ['2026-02-28T03:00:00Z', '2026-03-13T15:59:59.000Z'],
      ['2026-03-01T03:00:00Z', '2026-05-13T15:59:59.000Z'],
    ])('%s 에 발행한 발표는 %s 까지 作廢 할 수 있다', (issued, deadline) => {
      expect(getVoidDeadline(new Date(issued)).toISOString()).toBe(deadline);
    });

    it('InvoiceDate 는 대만 날짜로 만든다', () => {
      expect(toTaipeiDate(new Date('2026-11-25T17:00:00Z'))).toBe('2026-11-26');
      expect(toTaipeiDate(new Date('2026-11-25T15:59:59Z'))).toBe('2026-11-25');
    });

    it('전액 折讓 은 품목 합이 折讓 금액과 같고, 이메일이 없으면 통지를 끈다', () => {
      const invoice = plainToInstance(OrderInvoiceEntity, {
        invoiceNo: 'LY74004967',
        customerEmail: null,
      });

      const data = buildAllowanceData(
        invoice,
        3880,
        '2026-11-25',
        '訂單取消退款',
      );

      expect(data.AllowanceAmount).toBe(3880);
      expect(data.Items.reduce((sum, item) => sum + item.ItemAmount, 0)).toBe(
        3880,
      );
      expect(data.AllowanceNotify).toBe('N');
      expect(
        buildAllowanceData(
          plainToInstance(OrderInvoiceEntity, {
            invoiceNo: 'LY74004967',
            customerEmail: 'a@example.com',
          }),
          100,
          '2026-11-25',
          'x',
        ),
      ).toMatchObject({ AllowanceNotify: 'E', NotifyMail: 'a@example.com' });
    });
  });
});

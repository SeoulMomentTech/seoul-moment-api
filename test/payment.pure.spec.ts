import {
  ecpayUrlEncode,
  generateCheckMacValue,
  verifyCheckMacValue,
} from '@app/external/ecpay/ecpay.check-mac';
import {
  formatTaipeiDateTime,
  parseTaipeiDateTime,
} from '@app/external/ecpay/ecpay.date';
import {
  buildItemName,
  truncateUtf16,
} from '@app/external/ecpay/ecpay.service';
import {
  createLinePaySignature,
  parseLinePayJson,
} from '@app/external/linepay/linepay.signature';
import { createHmac } from 'crypto';

import { toCallbackParams } from '../apps/api/src/module/payment/ecpay-payment.service';
import { buildMerchantTradeNo } from '../apps/api/src/module/payment/payment.util';

/**
 * PG 연동의 순수 함수. 앱·DB 없이 돈다.
 * 인코딩 규칙 하나만 틀려도 모든 결제가 실패하므로 문서 예제값으로 고정한다.
 */
describe('결제 순수 함수', () => {
  describe('ECPay CheckMacValue', () => {
    // developers.ecpay.com.tw/2902 의 예제 그대로
    const HASH_KEY = 'pwFHCqoQZGmho4w6';
    const HASH_IV = 'EkRm7iFT261dpevs';
    const docParams = {
      TradeDesc: '促銷方案',
      PaymentType: 'aio',
      MerchantTradeDate: '2023/03/12 15:30:23',
      MerchantTradeNo: 'ecpay20230312153023',
      MerchantID: '3002607',
      ReturnURL: 'https://www.ecpay.com.tw/receive.php',
      ItemName: 'Apple iphone 15',
      TotalAmount: '30000',
      ChoosePayment: 'ALL',
      EncryptType: '1',
    };

    it('ECPay 문서 예제와 같은 값을 만든다', () => {
      // When
      const mac = generateCheckMacValue(docParams, HASH_KEY, HASH_IV);

      // Then
      expect(mac).toBe(
        '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840',
      );
    });

    it('파라미터 순서와 상관없이 같은 값이다', () => {
      // Given
      const reversed = Object.fromEntries(Object.entries(docParams).reverse());

      // Then
      expect(generateCheckMacValue(reversed, HASH_KEY, HASH_IV)).toBe(
        generateCheckMacValue(docParams, HASH_KEY, HASH_IV),
      );
    });

    it('받은 CheckMacValue 는 계산에서 빼고 검증한다', () => {
      // Given
      const signed = {
        ...docParams,
        CheckMacValue: generateCheckMacValue(docParams, HASH_KEY, HASH_IV),
      };

      // Then
      expect(verifyCheckMacValue(signed, HASH_KEY, HASH_IV)).toBe(true);
      expect(
        verifyCheckMacValue({ ...signed, TotalAmount: '1' }, HASH_KEY, HASH_IV),
      ).toBe(false);
      expect(
        verifyCheckMacValue(
          { ...signed, CheckMacValue: 'abc' },
          HASH_KEY,
          HASH_IV,
        ),
      ).toBe(false);
    });

    it(".NET UrlEncode 처럼 공백은 +, ~ 와 ' 는 인코딩하고 -_.!*() 는 그대로 둔다", () => {
      expect(ecpayUrlEncode("a b~c'd-_.!*()")).toBe('a+b%7ec%27d-_.!*()');
    });
  });

  describe('ECPay ItemName', () => {
    it('# 로 잇고 상품명 안의 # 는 공백으로 바꾼다', () => {
      expect(buildItemName(['셔츠 #1 x 2', '運費 x 1'])).toBe(
        '셔츠  1 x 2#運費 x 1',
      );
    });

    it('400자를 넘기면 ... 으로 자른다', () => {
      // Given
      const names = Array.from({ length: 50 }, (_, i) => `상품${i} x 1`);

      // When
      const itemName = buildItemName(names);

      // Then
      expect(Array.from(itemName)).toHaveLength(400);
      expect(itemName.endsWith('...')).toBe(true);
    });
  });

  describe('UTF-16 기준 자르기 (ECPay 는 .NET 이라 이모지를 2자로 센다)', () => {
    it('서로게이트 쌍을 반으로 쪼개지 않는다', () => {
      expect(truncateUtf16('ab😀c', 3)).toBe('ab');
      expect(truncateUtf16('ab😀c', 4)).toBe('ab😀');
    });
  });

  describe('대만 시각', () => {
    it('UTC 시각을 대만 시각 문자열로 바꾼다', () => {
      expect(formatTaipeiDateTime(new Date('2026-10-26T16:05:09Z'))).toBe(
        '2026/10/27 00:05:09',
      );
    });

    it('대만 시각 문자열을 정확한 시점으로 읽는다', () => {
      expect(parseTaipeiDateTime('2026/10/27 00:05:09')?.toISOString()).toBe(
        '2026-10-26T16:05:09.000Z',
      );
    });

    it('날짜만 오면(ATM 입금 기한) 그날 23:59:59 로 본다', () => {
      expect(parseTaipeiDateTime('2026/10/28')?.toISOString()).toBe(
        '2026-10-28T15:59:59.000Z',
      );
    });

    it('구분자가 - 여도 읽는다 (ECPay 가 두 형식을 섞어 쓴다)', () => {
      expect(parseTaipeiDateTime('2026-10-27 00:05:09')?.toISOString()).toBe(
        '2026-10-26T16:05:09.000Z',
      );
    });

    it('형식이 안 맞으면 null', () => {
      expect(parseTaipeiDateTime('')).toBeNull();
      expect(parseTaipeiDateTime('28/10/2026')).toBeNull();
    });
  });

  describe('ECPay 콜백 본문 모양', () => {
    const base = { MerchantTradeNo: 'ST1', CheckMacValue: 'X', RtnCode: '1' };

    it('form 객체면 문자열 맵으로 바꾼다', () => {
      expect(toCallbackParams({ ...base, TradeAmt: 100 })).toEqual({
        ...base,
        TradeAmt: '100',
      });
    });

    it('문자열(text/plain)·배열·중첩 객체·필수 필드 없는 본문은 거절한다', () => {
      expect(toCallbackParams('x'.repeat(5000))).toBeNull();
      expect(toCallbackParams([base])).toBeNull();
      expect(toCallbackParams({ ...base, nested: { a: 1 } })).toBeNull();
      expect(toCallbackParams({})).toBeNull();
    });

    it('필드가 100개를 넘거나 값이 2000자를 넘으면 거절한다', () => {
      const many = Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [`k${i}`, 'v']),
      );

      expect(toCallbackParams({ ...base, ...many })).toBeNull();
      expect(toCallbackParams({ ...base, big: 'y'.repeat(2001) })).toBeNull();
    });
  });

  describe('LINE Pay', () => {
    it('19자리 transactionId 를 숫자로 읽어 깨뜨리지 않는다', () => {
      // Given — JSON.parse 로 읽으면 2026102612345678000 처럼 끝자리가 바뀐다
      const text =
        '{"returnCode":"0000","info":{"transactionId":2026102612345678901,"paymentAccessToken":"187568751124"}}';

      // When
      const parsed = parseLinePayJson<{
        info: { transactionId: string };
      }>(text);

      // Then
      expect(parsed.info.transactionId).toBe('2026102612345678901');
    });

    it('서명은 ChannelSecret + 경로 + 본문 + nonce 의 HMAC-SHA256 Base64 다', () => {
      // Given
      const body = '{"amount":100}';
      const expected = createHmac('sha256', 'secret')
        .update('secret/v3/payments/request' + body + 'nonce-1')
        .digest('base64');

      // Then
      expect(
        createLinePaySignature(
          'secret',
          '/v3/payments/request',
          body,
          'nonce-1',
        ),
      ).toBe(expected);
    });
  });

  describe('거래번호', () => {
    it('운영은 접두사 + id 12자리', () => {
      expect(buildMerchantTradeNo('SM', 1234, true)).toBe('SM000000001234');
    });

    it('그 밖에는 시각을 섞어 공용 테스트 상점에서 남의 번호와 겹치지 않는다', () => {
      // When
      const a = buildMerchantTradeNo('SD', 1, false, 1_700_000_000_000);
      const b = buildMerchantTradeNo('SD', 1, false, 1_700_000_000_001);

      // Then
      expect(a).not.toBe(b);
      expect(a).toMatch(/^[A-Za-z0-9]{1,20}$/);
    });

    it('접두사의 영숫자 아닌 문자는 지운다', () => {
      expect(buildMerchantTradeNo('S-M', 1, true)).toBe('SM000000000001');
    });
  });
});

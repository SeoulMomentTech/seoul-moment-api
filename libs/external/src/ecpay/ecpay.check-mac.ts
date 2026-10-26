import { createHash, timingSafeEqual } from 'crypto';

type EcpayParams = Record<string, string | number>;

/**
 * ECPay CheckMacValue (SHA256, EncryptType=1). developers.ecpay.com.tw/2902
 *
 * 1. CheckMacValue 를 뺀 파라미터를 키 이름 A→Z 로 정렬해 key=value 를 & 로 잇는다
 * 2. 앞에 HashKey=…&, 뒤에 &HashIV=… 를 붙인다
 * 3. 문자열 전체를 URL 인코딩(.NET 방식)한 뒤 소문자로 바꾼다
 * 4. SHA256 → 대문자
 *
 * 콜백 검증도 같은 함수로 한다. 받은 필드 전부(모르는 필드 포함)로 계산해야 맞는다.
 */
export function generateCheckMacValue(
  params: EcpayParams,
  hashKey: string,
  hashIV: string,
): string {
  const query = Object.keys(params)
    .filter((key) => key !== 'CheckMacValue')
    .sort(compareKey)
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const raw = `HashKey=${hashKey}&${query}&HashIV=${hashIV}`;

  return createHash('sha256')
    .update(ecpayUrlEncode(raw).toLowerCase())
    .digest('hex')
    .toUpperCase();
}

export function verifyCheckMacValue(
  params: EcpayParams,
  hashKey: string,
  hashIV: string,
): boolean {
  const received = String(params.CheckMacValue ?? '').toUpperCase();
  const expected = generateCheckMacValue(params, hashKey, hashIV);

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/**
 * .NET HttpUtility.UrlEncode 와 같은 결과를 낸다 (developers.ecpay.com.tw/2904).
 * encodeURIComponent 와 다른 점: 공백은 +, ~ 와 ' 는 인코딩한다.
 * - _ . ! * ( ) 는 둘 다 인코딩하지 않는다.
 */
export function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
}

function compareKey(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();

  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

import { createCipheriv, createDecipheriv } from 'crypto';

/**
 * ECPay 전자발표 API 의 Data 암호화 (developers.ecpay.com.tw/7958).
 * JSON → encodeURIComponent → AES-128-CBC(PKCS7, key=HashKey, iv=HashIV) → Base64.
 * 응답은 반대 순서로 푼다.
 */
export function encryptEcpayData(
  data: unknown,
  hashKey: string,
  hashIV: string,
): string {
  const cipher = createCipheriv(
    'aes-128-cbc',
    Buffer.from(hashKey, 'utf8'),
    Buffer.from(hashIV, 'utf8'),
  );
  const plain = encodeURIComponent(JSON.stringify(data));

  return cipher.update(plain, 'utf8', 'base64') + cipher.final('base64');
}

export function decryptEcpayData<T>(
  encrypted: string,
  hashKey: string,
  hashIV: string,
): T {
  const decipher = createDecipheriv(
    'aes-128-cbc',
    Buffer.from(hashKey, 'utf8'),
    Buffer.from(hashIV, 'utf8'),
  );
  const plain =
    decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8');

  return JSON.parse(decodeURIComponent(plain.replace(/\+/g, '%20'))) as T;
}

import { createHmac } from 'crypto';

/**
 * LINE Pay Online API 요청 서명.
 * Base64(HMAC-SHA256(key = ChannelSecret, ChannelSecret + API 경로 + 본문 + nonce))
 * GET 은 본문 자리에 쿼리스트링(없으면 빈 문자열)을 넣는다.
 */
export function createLinePaySignature(
  channelSecret: string,
  apiPath: string,
  bodyOrQuery: string,
  nonce: string,
): string {
  return createHmac('sha256', channelSecret)
    .update(`${channelSecret}${apiPath}${bodyOrQuery}${nonce}`)
    .digest('base64');
}

/**
 * LINE Pay 응답 JSON 파싱. transactionId 는 19자리라 JSON.parse 가 Number 로
 * 읽으면 2^53 을 넘어 값이 깨진다. 문서의 handleBigInteger() 처럼 16자리 이상
 * 숫자를 파싱 전에 문자열로 감싼다.
 */
export function parseLinePayJson<T>(text: string): T {
  const safe = text.replace(/:\s*(\d{16,})(?=\s*[,}\]])/g, ':"$1"');

  return JSON.parse(safe) as T;
}

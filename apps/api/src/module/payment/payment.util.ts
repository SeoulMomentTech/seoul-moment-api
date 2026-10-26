import { randomBytes } from 'crypto';

/**
 * 결제 시도 거래번호. ECPay MerchantTradeNo 제약(영숫자, 20자 이하, 재사용 불가)을 따른다.
 *
 * - 운영: 접두사 + payment.id 12자리 0패딩 (예: SM000000001234). id 기반이라 충돌이 없다.
 * - 그 밖: ECPay 공개 테스트 상점은 전 세계 개발자가 같이 쓰므로 id 만으로는 남의 번호와
 *   겹친다. 밀리초 시각(36진수)을 섞는다. 예: SD + MH2K3J4L + 000123 → 16자
 */
export function buildMerchantTradeNo(
  prefix: string,
  paymentId: number,
  isProd: boolean,
  now: number = Date.now(),
): string {
  const safePrefix = prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'SM';

  if (isProd) {
    return `${safePrefix}${String(paymentId).padStart(12, '0')}`;
  }

  const time = now.toString(36).toUpperCase();
  const tail = String(paymentId % 1_000_000).padStart(6, '0');

  return `${safePrefix}${time}${tail}`.slice(0, 20);
}

/** handoff · 결과 페이지용 토큰. URL 경로에 그대로 들어가도록 base64url 로 만든다 */
export function createPaymentAccessToken(): string {
  return randomBytes(24).toString('base64url');
}

export function minutesAgo(minutes: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

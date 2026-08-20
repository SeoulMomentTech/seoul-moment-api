import { plainToInstance } from 'class-transformer';

export const FIREBASE_MESSAGING = 'FIREBASE_MESSAGING';

/** initializeApp 이름. 기본 앱을 건드리지 않아 다른 Firebase 사용처와 충돌하지 않는다. */
export const FIREBASE_APP_NAME = 'plan-fcm';

/** sendEachForMulticast 1회 최대 토큰 수 (FCM 제한). 넘으면 나눠 보내야 한다. */
export const FCM_MULTICAST_MAX_TOKENS = 500;

/**
 * "이 토큰은 죽었다"는 뜻의 에러 코드. 이 경우에만 토큰을 지운다.
 * 그 외(쿼터·네트워크·서버 오류)는 일시적이라 지우면 멀쩡한 기기를 잃는다.
 */
const UNREGISTERED_ERROR_CODES: readonly string[] = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

/**
 * 토큰 형식이 깨졌을 때도, 페이로드가 잘못됐을 때도 같은 코드가 온다.
 * 둘을 구분하지 못한 채 지우면 페이로드 버그 한 번에 기기 토큰이 전부 날아간다.
 */
export const INVALID_ARGUMENT_ERROR_CODE = 'messaging/invalid-argument';

export const isUnregisteredTokenError = (code?: string): boolean =>
  !!code && UNREGISTERED_ERROR_CODES.includes(code);

/**
 * FCM 발송 결과. invalidTokens 를 raw 배열로 흘리지 않고 성공/실패 수와 함께 묶어
 * 호출부가 "무엇을 지워야 하는지"만 보게 한다.
 */
export class FcmSendResultDto {
  successCount: number;
  failureCount: number;
  /** 더 이상 유효하지 않아 삭제해야 하는 토큰 */
  invalidTokens: string[];
  /** 자격증명 미설정·대상 없음 등으로 발송 자체를 건너뛴 경우 */
  skipped: boolean;

  static from(
    successCount: number,
    failureCount: number,
    invalidTokens: string[],
  ): FcmSendResultDto {
    return plainToInstance(this, {
      successCount,
      failureCount,
      invalidTokens,
      skipped: false,
    });
  }

  static skipped(): FcmSendResultDto {
    return plainToInstance(this, {
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      skipped: true,
    });
  }

  hasInvalidTokens(): boolean {
    return this.invalidTokens.length > 0;
  }
}

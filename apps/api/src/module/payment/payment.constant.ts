/** ECPay 결제창(handoff) 링크를 열 수 있는 시간 */
export const HANDOFF_TTL_MINUTES = 30;

/** 결과 페이지 토큰 유효 기간 — ATM·편의점 입금 기한보다 길게 둔다 */
export const RESULT_TOKEN_TTL_DAYS = 7;

/** 결제창으로 넘긴 뒤 이 시간이 지나도 결과가 없으면 이탈로 보고 재고를 돌려준다 */
export const ABANDON_AFTER_MINUTES = 30;

/** LINE Pay 는 이 시간이 지나면 상태 조회로 확인을 시작한다 */
export const LINEPAY_CHECK_AFTER_MINUTES = 10;

/** ECPay 결제창을 연 뒤 이 시간 동안은 결제 중으로 본다 (이탈 판정은 그 뒤에) */
export const ECPAY_CHECKOUT_MINUTES = 60;

/** ECPay 조회가 계속 실패해도 이 시간이 지나면 만료 처리한다 */
export const ECPAY_FORCE_EXPIRE_HOURS = 2;

/**
 * 입금 기한이 지났는데 ECPay 조회가 계속 안 되면 이 시간만큼 더 기다린 뒤 만료한다.
 * 조회 없이 만료하면 ReturnURL 을 놓친 입금이 취소 주문이 된다.
 */
export const DEPOSIT_FORCE_EXPIRE_HOURS = 24;

/**
 * ECPay 콜백 본문 상한. ECPay 는 필드를 20–40개, 값은 짧게 보낸다.
 * 넘으면 서명 계산 전에 거절한다 — 거대한 본문으로 정렬·인코딩 CPU 를 태우는 공격을 막는다.
 */
export const CALLBACK_MAX_FIELDS = 100;
export const CALLBACK_MAX_VALUE_LENGTH = 2000;

/** QueryTradeInfo 를 연달아 부르면 403 + 30분 차단이라 건마다 쉰다 */
export const ECPAY_QUERY_INTERVAL_MS = 300;

/** 결제를 시작하지 않은(또는 시도가 모두 끝난) PENDING 주문을 취소하는 시간 */
export const PENDING_ORDER_TTL_HOURS = 24;

/** 재고를 잡고 있으므로 입금 기한을 짧게 둔다 (ECPay 기본값은 ATM 3일, 편의점 7일) */
export const ECPAY_ATM_EXPIRE_DAYS = 2;
export const ECPAY_CVS_EXPIRE_MINUTES = 2 * 24 * 60;

/**
 * StoreExpireDate 를 편의점 코드는 분, 바코드는 일 단위로 읽는다. 같은 값을 둘 다에
 * 보낼 수 없어서 바코드는 숨긴다 (편의점 코드로 같은 편의점 납부가 된다).
 */
export const ECPAY_IGNORE_PAYMENTS = ['BARCODE'];

export const LINEPAY_CONFIRM_LOCK_SECONDS = 90;

/**
 * 배치 최악 실행 시간보다 길게 둔다: ECPay 조회 50건 × 10초 + LINE Pay 확인 50건 ×
 * (조회 20초 + Confirm 60초) + 발표 재시도 100건 × 45초 ≈ 2시간이 이론상 최악이지만,
 * 그만큼 느려지면 PG 장애이므로 겹쳐 돌아도 상태 전이는 DB 락으로 멱등이다.
 * 정상 상황(수 분)을 넉넉히 덮는 값으로 둔다.
 */
export const PAYMENT_BATCH_LOCK_SECONDS = 45 * 60;

/** LINE Pay 조회가 계속 안 되면 이 시간이 지난 시도를 만료한다 (승인은 몇 분이면 소멸) */
export const LINEPAY_FORCE_EXPIRE_HOURS = 24;

/** 입금 기한이 지나도 은행 통지가 늦을 수 있어 이만큼 기다린 뒤 만료를 판단한다 */
export const DEPOSIT_GRACE_MINUTES = 60;

/** LINE Pay 요청을 보내지 못한 READY 시도를 정리하는 시간 */
export const READY_EXPIRE_MINUTES = 10;

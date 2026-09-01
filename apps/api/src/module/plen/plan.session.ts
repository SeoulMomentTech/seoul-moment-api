import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlatformType } from '@app/repository/enum/plan-user.enum';

/**
 * 로그인 세션 수명.
 *
 * 예전에는 `36500d`(약 100년)였다. 회수할 방법이 없는 토큰에 붙일 수명이
 * 아니고, 어차피 가드가 카카오 토큰을 매번 확인해서 실제로는 6시간이면
 * 끊겼다. 지금은 이 값이 그대로 세션 수명이다.
 */
export const PLAN_SESSION_EXPIRE_TIME = '180d';

/**
 * 남은 수명이 이보다 적으면 요청을 처리하면서 새 토큰을 함께 내준다
 * (표준 세션의 절반).
 *
 * 이게 있어야 세션이 **쓰는 동안 계속** 유지된다. 없으면 아무리 매일 들어와도
 * 로그인한 지 180일째에 한 번 튕긴다. 90일에 한 번만 갱신되므로 토큰이
 * 요청마다 바뀌지 않는다 — 자주 갈아 끼우면 클라이언트가 저장한 값과
 * 어긋날 틈만 늘어난다.
 */
export const PLAN_SESSION_RENEW_BEFORE_SEC = 90 * 24 * 60 * 60;

/**
 * 갱신된 토큰을 실어 보내는 응답 헤더.
 *
 * 응답 본문을 건드리지 않는 이유는, 갱신이 **모든 플랜 API 에서** 일어나는데
 * 그 응답 모양을 전부 바꿀 수는 없기 때문이다. 프론트는 공통 fetch 래퍼
 * 한 곳에서 이 헤더만 보면 된다.
 *
 * 브라우저는 다른 오리진의 응답에서 **CORS 로 노출한 헤더만** 읽을 수 있다.
 * `main.ts` 의 `exposedHeaders` 에서 빼면 프론트에서는 이 헤더가 아예 없는
 * 것처럼 보이고, 갱신이 조용히 죽는다.
 */
export const RENEWED_TOKEN_HEADER = 'X-Renewed-Token';

/** 플랜 JWT payload. 로그인과 갱신이 같은 모양을 내도록 여기 한 곳에서 만든다 */
export function buildPlanTokenPayload(
  planUser: PlanUserEntity,
  platformType: PlatformType,
): Record<string, any> {
  return {
    platformType,
    planUserId: planUser.id,
    kakaoId: planUser.kakaoId,
    tokenVersion: planUser.tokenVersion ?? 0,
  };
}

/**
 * 이번 변경 전에 나간 토큰인지.
 *
 * 옛 토큰에는 **카카오 access_token 이 그대로 박혀 있다.** JWT payload 는
 * base64 라 주운 사람이 카카오 API 를 직접 부를 수 있으므로, 수명이 남았어도
 * 갱신 대상으로 삼아 새 모양으로 갈아 끼운다. 100년짜리라 수명만 보면
 * 영영 갈리지 않는다.
 */
export function isLegacyPlanTokenPayload(
  payload: Record<string, any>,
): boolean {
  return payload.kakaoToken !== undefined || payload.tokenVersion === undefined;
}

import { JwtAudience } from './auth.dto';

type TokenPayload = Record<string, unknown>;

/**
 * 토큰 주체 id. 양의 정수가 아니면 null.
 *
 * TypeORM 은 where 의 undefined 를 "조건 없음"으로 보고 첫 행을 돌려준다.
 * 이 값을 확인하지 않고 조회에 넘기면 id 없는 토큰(분리 전 plen 토큰 등)이
 * 첫 관리자·회원으로 인증된다.
 */
export function getTokenSubjectId(payload: TokenPayload): number | null {
  const { id } = payload;

  return Number.isInteger(id) && (id as number) > 0 ? (id as number) : null;
}

/** 관리자 토큰. aud 도입 전 토큰은 회원 토큰과 구별할 수 없어서 받지 않는다. */
export function isAdminToken(payload: TokenPayload): boolean {
  return payload.aud === JwtAudience.ADMIN;
}

/**
 * 회원 토큰. aud 도입 전에 발급된 토큰(aud 없음)도 받아 기존 회원 세션을
 * 유지한다. 그 안에는 배포 전 관리자 one-time 토큰도 섞여 있을 수 있어,
 * 그 토큰은 만료(JWT_EXPIRES_IN)될 때까지 같은 번호의 회원으로 통과한다.
 * refresh 토큰은 DB 에 저장된 값과 대조하므로 이렇게 넘어오지 못한다.
 */
export function isUserToken(payload: TokenPayload): boolean {
  return payload.aud === undefined || payload.aud === JwtAudience.USER;
}

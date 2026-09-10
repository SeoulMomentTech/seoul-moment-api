import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';

/**
 * 결혼식까지 남은 일수.
 *
 * **피드의 것을 그대로 쓴다.** KST 자정 기준으로 세는 것과 `date` 컬럼이
 * 드라이버에 따라 문자열로도 Date 로도 오는 것을 이미 거기서 다루고 있다 —
 * 복사해 두면 한쪽만 고쳐져 하루씩 어긋나는 날이 온다.
 */
export { daysUntilWedding } from '../feed/plan-feed.util';

/**
 * `date` 컬럼을 'YYYY-MM-DD' 로.
 *
 * 앱은 이 문자열을 쪼개 "2026년 11월 14일 (토)" 를 만든다. ISO 로 내보내면
 * 시각이 붙어 타임존만큼 하루가 밀린다 — `new Date("YYYY-MM-DD")` 를 직접
 * 파싱하지 말라는 앱 쪽 규칙과 짝이다.
 */
export function toDateString(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);

  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 자랑하기에 낼 이름.
 *
 * 배우자가 있으면 **"지수 · 현우"**, 없으면 내 이름 하나다. 이 앱의 메리트가
 * "신랑·신부가 같이" 라 두 이름이 나란히 있는 것 자체가 자랑거리다.
 *
 * **이름이 비어 있으면 올릴 수 없다** — 부르는 이름이 없으면 자랑하기 목록에
 * 빈 카드가 생긴다. 그 판단은 서비스가 하고 여기서는 만들기만 한다.
 */
export function coupleNickname(
  owner: Pick<PlanUserEntity, 'name'>,
  spouse?: Pick<PlanUserEntity, 'name'> | null,
): string {
  const names = [owner?.name, spouse?.name]
    .map((name) => name?.trim())
    .filter((name): name is string => !!name);

  return names.join(' · ');
}

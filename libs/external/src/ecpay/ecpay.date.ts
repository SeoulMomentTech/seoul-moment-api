/**
 * ECPay 는 날짜를 대만 시각(UTC+8, 서머타임 없음) 문자열로 주고받는다.
 * 서버(ECS)는 UTC, dev 컨테이너는 Asia/Seoul 이라 로컬 시각 API 를 쓰면 어긋난다.
 * 그래서 고정 오프셋으로만 계산한다.
 */
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Date → 'yyyy/MM/dd HH:mm:ss' (대만 시각) */
export function formatTaipeiDateTime(date: Date): string {
  const t = new Date(date.getTime() + TAIPEI_OFFSET_MS);

  const yyyy = t.getUTCFullYear();
  const MM = pad(t.getUTCMonth() + 1);
  const dd = pad(t.getUTCDate());
  const HH = pad(t.getUTCHours());
  const mm = pad(t.getUTCMinutes());
  const ss = pad(t.getUTCSeconds());

  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

/**
 * 'yyyy/MM/dd HH:mm:ss' 또는 'yyyy/MM/dd' (대만 시각) → Date. 구분자는 '-' 도 받는다.
 * 날짜만 오면(ATM 입금 기한) 그날 23:59:59 까지로 본다 — ECPay 는 마지막 날 23:59 마감이다.
 * 형식이 안 맞으면 null.
 */
export function parseTaipeiDateTime(value: string | undefined): Date | null {
  const match =
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      (value ?? '').trim(),
    );

  if (!match) {
    return null;
  }

  const [, y, M, d, H, m, s] = match;
  const hasTime = H !== undefined;

  const utc = Date.UTC(
    Number(y),
    Number(M) - 1,
    Number(d),
    hasTime ? Number(H) : 23,
    hasTime ? Number(m) : 59,
    hasTime ? Number(s ?? 0) : 59,
  );

  return new Date(utc - TAIPEI_OFFSET_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

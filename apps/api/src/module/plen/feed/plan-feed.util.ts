/** 시/도 이름을 짧게. 표시할 때도 쓰고 필터 접두어로도 쓴다 */
const PROVINCE_SHORT: Record<string, string> = {
  서울특별시: '서울',
  서울시: '서울',
  서울: '서울',
  부산광역시: '부산',
  부산시: '부산',
  부산: '부산',
  대구광역시: '대구',
  대구: '대구',
  인천광역시: '인천',
  인천: '인천',
  광주광역시: '광주',
  광주: '광주',
  대전광역시: '대전',
  대전: '대전',
  울산광역시: '울산',
  울산: '울산',
  세종특별자치시: '세종',
  세종시: '세종',
  세종: '세종',
  경기도: '경기',
  경기: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  강원: '강원',
  충청북도: '충북',
  충북: '충북',
  충청남도: '충남',
  충남: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전북: '전북',
  전라남도: '전남',
  전남: '전남',
  경상북도: '경북',
  경북: '경북',
  경상남도: '경남',
  경남: '경남',
  제주특별자치도: '제주',
  제주도: '제주',
  제주: '제주',
};

/**
 * 주소에서 **시/도 + 시·군·구까지만** 남긴다.
 *
 * 일정의 `location` 은 카카오 주소 검색이 채운 전체 주소다. 그대로 피드에
 * 올리면 업체 주소는 물론이고 사람이 직접 적은 집 주소까지 통째로 공개된다.
 * 후기를 고를 때 필요한 건 "서울 강남구" 정도지 번지수가 아니다.
 *
 * **아는 시/도로 시작하지 않으면 null 을 준다.** "테헤란로 123 5층" 같은
 * 조각을 앞 두 토큰만 잘라 내보내면 그게 곧 주소 유출이라, 확실할 때만
 * 값을 만든다.
 */
export function toRegion(location?: string | null): string | null {
  const trimmed = location?.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  const province = PROVINCE_SHORT[tokens[0]];
  if (!province) return null;

  const second = tokens[1];
  if (second && /[시군구]$/.test(second)) return `${province} ${second}`;
  return province;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 기준 오늘 자정 (UTC 밀리초) */
function kstMidnight(date: Date): number {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
}

/**
 * 결혼식까지 남은 일수. 지난 날짜는 음수.
 *
 * 한국 사용자만 쓰는 서비스라 **KST 자정 기준**으로 센다. 서버가 UTC 로
 * 돌면 한국 시간 오전 9시 전에는 하루가 어긋난다.
 * `date` 컬럼이라 드라이버에 따라 문자열로도 Date 로도 온다.
 */
export function daysUntilWedding(
  weddingDate: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!weddingDate) return null;

  let target: number;
  if (typeof weddingDate === 'string') {
    const [y, m, d] = weddingDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    target = Date.UTC(y, m - 1, d);
  } else {
    target = kstMidnight(weddingDate);
  }

  return Math.round((target - kstMidnight(now)) / DAY_MS);
}

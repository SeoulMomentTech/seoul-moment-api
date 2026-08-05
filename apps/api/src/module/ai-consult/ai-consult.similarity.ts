/**
 * 카테고리 이름 오타 흡수용 문자열 유사도.
 *
 * 음절 단위로 비교하면 "악세사리" vs "악세서리" 가 4글자 중 1글자(75%) 차이지만,
 * 실제로 다른 것은 중성 하나뿐이다. 자모로 쪼개면 9개 중 1개(89%) 차이가 되어
 * "오타 한 글자"와 "아예 다른 카테고리"를 임계값 하나로 가를 수 있다.
 */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const CHOSEONG_BASE = 0x1100;
const JUNGSEONG_BASE = 0x1161;
/** 종성은 0(없음)이 인덱스 0 이라 base 가 첫 종성보다 1 작다. */
const JONGSEONG_BASE = 0x11a7;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

/** 부분 비교 시 이 길이 미만의 창은 우연히 겹칠 확률이 높아 보지 않는다. */
const MIN_WINDOW_LENGTH = 2;

/**
 * 한글 음절을 초·중·종성으로 분해한다. 한글이 아닌 문자는 그대로 통과시켜
 * 영문·중문 이름도 같은 함수로 비교할 수 있게 한다.
 */
export function toJamo(value: string): string {
  let result = '';

  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code < HANGUL_FIRST || code > HANGUL_LAST) {
      result += char;
      continue;
    }

    const index = code - HANGUL_FIRST;
    const jongseong = index % JONGSEONG_COUNT;
    const jungseong = Math.floor(index / JONGSEONG_COUNT) % JUNGSEONG_COUNT;
    const choseong = Math.floor(index / (JUNGSEONG_COUNT * JONGSEONG_COUNT));

    result +=
      String.fromCharCode(CHOSEONG_BASE + choseong) +
      String.fromCharCode(JUNGSEONG_BASE + jungseong) +
      (jongseong > 0 ? String.fromCharCode(JONGSEONG_BASE + jongseong) : '');
  }

  return result;
}

/** 두 행만 들고 도는 Levenshtein. 이름·질의 모두 짧아 이 이상의 최적화는 불필요하다. */
function levenshtein(source: string, target: string): number {
  if (source === target) return 0;
  if (!source.length) return target.length;
  if (!target.length) return source.length;

  let previous = Array.from({ length: target.length + 1 }, (_, i) => i);

  for (let i = 1; i <= source.length; i++) {
    const current = [i];

    for (let j = 1; j <= target.length; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;

      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }

    previous = current;
  }

  return previous[target.length];
}

/** 자모 단위 편집거리를 0~1 유사도로 환산한다. */
export function jamoSimilarity(left: string, right: string): number {
  const a = toJamo(left);
  const b = toJamo(right);
  const longest = Math.max(a.length, b.length);

  if (longest === 0) return 0;

  return 1 - levenshtein(a, b) / longest;
}

/**
 * 질의 안에 이름이 묻혀 있는 경우("악세사리카테고리", "이악세사리")까지 잡는다.
 * 전체 비교 + 이름 길이 ±1 크기의 창을 훑어 가장 높은 값을 쓴다.
 * 오타로 글자 수가 한 칸 어긋나도 창 하나는 이름에 맞아떨어진다.
 */
export function findBestSimilarity(query: string, name: string): number {
  let best = jamoSimilarity(query, name);

  for (let size = name.length - 1; size <= name.length + 1; size++) {
    if (size < MIN_WINDOW_LENGTH || size >= query.length) continue;

    for (let start = 0; start + size <= query.length; start++) {
      const window = query.slice(start, start + size);

      best = Math.max(best, jamoSimilarity(window, name));
    }
  }

  return best;
}

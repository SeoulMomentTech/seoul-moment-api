/**
 * 색상 이름을 DB 색상에 붙이는 마지막 구제 경로.
 *
 * 자모 유사도는 표기 흔들림("블랰"→"블랙")만 흡수할 수 있고, **어휘가 다른 같은 색**
 * ("빨강" vs DB 의 "레드", 유사도 0.167)은 영원히 못 붙인다. 운영 로그에서 상품 검색
 * 실패 14건 중 12건이 이 경우였다.
 *
 * 그래서 이름이 아니라 **색 자체**로 비교한다. `option_value.color_code` 에 hex 가
 * 들어있으므로, 고객이 쓴 보편 색이름을 기준 hex 로 바꾼 뒤 DB 색상과 색공간 거리를 잰다.
 * 이렇게 하면 DB 에 색이 추가돼도 이 파일을 고칠 일이 없다 — 아래 표에는 DB 색상명이
 * 아니라 "한국어에서 빨강은 #FF0000 이다"라는 언어에 대한 사실만 들어간다.
 */

/**
 * 보편 색이름 → 기준 hex.
 *
 * **DB 색상명(레드·네이비·소라…)을 여기 넣지 마십시오.** 넣는 순간 DB 가 바뀔 때마다
 * 이 파일을 고쳐야 하는 구조가 되어, 이 방식을 택한 이유가 사라진다.
 * 여기 있어야 하는 것은 "고객이 색을 부르는 보편적인 말"뿐이다.
 */
export const BASIC_COLOR_HEX: Readonly<Record<string, string>> = {
  빨강: '#FF0000',
  빨간색: '#FF0000',
  빨간: '#FF0000',
  붉은: '#FF0000',
  레드: '#FF0000',
  red: '#FF0000',
  红色: '#FF0000',
  紅色: '#FF0000',

  주황: '#FFA500',
  주황색: '#FFA500',
  오렌지: '#FFA500',
  orange: '#FFA500',
  橙色: '#FFA500',

  노랑: '#FFFF00',
  노란색: '#FFFF00',
  노란: '#FFFF00',
  옐로우: '#FFFF00',
  yellow: '#FFFF00',
  黄色: '#FFFF00',
  黃色: '#FFFF00',

  초록: '#008000',
  초록색: '#008000',
  녹색: '#008000',
  그린: '#008000',
  green: '#008000',
  绿色: '#008000',
  綠色: '#008000',

  파랑: '#0000FF',
  파란색: '#0000FF',
  파란: '#0000FF',
  블루: '#0000FF',
  blue: '#0000FF',
  蓝色: '#0000FF',
  藍色: '#0000FF',

  하늘: '#87CEEB',
  하늘색: '#87CEEB',
  스카이블루: '#87CEEB',
  skyblue: '#87CEEB',

  남색: '#000080',
  네이비: '#000080',
  navy: '#000080',

  보라: '#800080',
  보라색: '#800080',
  퍼플: '#800080',
  purple: '#800080',
  紫色: '#800080',

  분홍: '#FFC0CB',
  분홍색: '#FFC0CB',
  핑크: '#FFC0CB',
  pink: '#FFC0CB',
  粉色: '#FFC0CB',

  갈색: '#A52A2A',
  브라운: '#A52A2A',
  brown: '#A52A2A',
  棕色: '#A52A2A',

  검정: '#000000',
  검정색: '#000000',
  검은색: '#000000',
  까만색: '#000000',
  블랙: '#000000',
  black: '#000000',
  黑色: '#000000',

  하양: '#FFFFFF',
  하얀색: '#FFFFFF',
  흰색: '#FFFFFF',
  화이트: '#FFFFFF',
  white: '#FFFFFF',
  白色: '#FFFFFF',

  회색: '#808080',
  그레이: '#808080',
  gray: '#808080',
  grey: '#808080',
  灰色: '#808080',
};

/**
 * Lab 채도가 이 값 미만이면 무채색(검정·회색·흰색 계열)으로 본다.
 *
 * 무채색과 유채색은 서로 매칭 후보가 되면 안 된다. 저채도 색은 모든 유채색에서
 * 어중간한 거리를 갖기 때문에, 이 게이트가 없으면 "파랑색 옷"에 차콜(회색)이 1위로
 * 붙는다. 실측에서 확인된 오답이다.
 */
export const COLOR_ACHROMATIC_CHROMA_MAX = 12;

/**
 * 유채색끼리의 거리 상한(CIE76 ΔE).
 *
 * 70 은 "파랑→네이비"(57)·"보라→라이트퍼플"(61)은 살리고 "파랑→사파이어블루"(75)는
 * 자르는 지점이다. 실측표는 계획 문서 참고.
 */
export const COLOR_CHROMATIC_DELTA_E_MAX = 70;

/**
 * 무채색끼리의 거리 상한. 무채색은 사실상 명도차만 남으므로 유채색보다 좁게 잡는다.
 * 35 면 "검정→블랙·주니퍼·리드그레이·차콜"은 붙고 "검정→그레이"(54)는 떨어진다.
 */
export const COLOR_ACHROMATIC_DELTA_E_MAX = 35;

/**
 * 유채색끼리 허용하는 색상(Hue) 각도 차이.
 *
 * 거리만으로는 "보라→네이비"(ΔE 35)가 1위로 붙는다. 둘은 명도·채도가 비슷할 뿐
 * 색 자체가 다르므로, 색상환에서 얼마나 떨어져 있는지를 따로 본다.
 * 보라(−34°)와 네이비(−55°)는 21° 차이로 걸러지고, 라이트퍼플(−34°)은 통과한다.
 */
export const COLOR_HUE_DEGREE_MAX = 20;

/** sRGB → Lab 변환에 쓰는 D65 백색점. */
const WHITE_POINT_X = 0.95047;
const WHITE_POINT_Z = 1.08883;
const LAB_EPSILON = 0.008856;
const LAB_KAPPA = 7.787;

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

/**
 * CIE L*a*b* 좌표 하나.
 *
 * 비교 규칙(채도·색상환 거리)을 여기 가둬 호출부가 a*·b* 를 직접 만지지 않게 한다.
 */
export class AiConsultLabDto {
  private constructor(
    private readonly l: number,
    private readonly a: number,
    private readonly b: number,
  ) {}

  static from(l: number, a: number, b: number): AiConsultLabDto {
    return new AiConsultLabDto(l, a, b);
  }

  /** 채도. 0 에 가까울수록 무채색이다. */
  getChroma(): number {
    return Math.hypot(this.a, this.b);
  }

  isAchromatic(): boolean {
    return this.getChroma() < COLOR_ACHROMATIC_CHROMA_MAX;
  }

  /** 색상환 각도(도). 무채색에서는 의미가 없으므로 호출 전에 걸러야 한다. */
  getHueDegree(): number {
    const degree = (Math.atan2(this.b, this.a) * 180) / Math.PI;

    return degree < 0 ? degree + 360 : degree;
  }

  /**
   * CIE76 ΔE.
   *
   * CIEDE2000 을 쓰지 않는다. 그쪽은 육안 구분 한계(근거리)용으로 설계돼 원거리에서
   * 색공간을 압축해버려, 실측에서 "파랑→차콜"·"초록→그레이"처럼 무채색이 1위로
   * 올라왔다. 우리가 필요한 건 "같은 색 계열인가"라 단순 유클리드가 더 맞다.
   */
  distanceTo(other: AiConsultLabDto): number {
    return Math.hypot(this.l - other.l, this.a - other.a, this.b - other.b);
  }

  /** 색상환은 순환하므로 340° 와 20° 의 차이는 320° 가 아니라 40° 다. */
  hueDifferenceTo(other: AiConsultLabDto): number {
    const diff = Math.abs(this.getHueDegree() - other.getHueDegree());

    return diff > 180 ? 360 - diff : diff;
  }

  /**
   * 같은 색 계열로 볼 수 있는지.
   * 무채색과 유채색은 서로 후보가 되지 않고, 각각 다른 상한을 쓴다.
   */
  isSameFamily(other: AiConsultLabDto): boolean {
    if (this.isAchromatic() !== other.isAchromatic()) return false;

    if (this.isAchromatic()) {
      return this.distanceTo(other) <= COLOR_ACHROMATIC_DELTA_E_MAX;
    }

    return (
      this.distanceTo(other) <= COLOR_CHROMATIC_DELTA_E_MAX &&
      this.hueDifferenceTo(other) <= COLOR_HUE_DEGREE_MAX
    );
  }
}

/** sRGB 감마 보정 해제. */
function toLinear(channel: number): number {
  return channel > 0.04045
    ? Math.pow((channel + 0.055) / 1.055, 2.4)
    : channel / 12.92;
}

function toLabComponent(value: number): number {
  return value > LAB_EPSILON ? Math.cbrt(value) : LAB_KAPPA * value + 16 / 116;
}

/**
 * hex → Lab. 형식이 어긋나면 null 을 돌려 호출부가 조용히 건너뛰게 한다.
 * `color_code` 는 nullable 이고 소문자(`#c0ffee`)도 섞여 있어 대소문자를 가리지 않는다.
 */
export function parseHexToLab(hex: string | null): AiConsultLabDto | null {
  const matched = hex?.trim().match(HEX_PATTERN);

  if (!matched) return null;

  const [r, g, b] = [0, 2, 4].map((offset) =>
    toLinear(parseInt(matched[1].slice(offset, offset + 2), 16) / 255),
  );

  const x = toLabComponent(
    (r * 0.4124 + g * 0.3576 + b * 0.1805) / WHITE_POINT_X,
  );
  const y = toLabComponent(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = toLabComponent(
    (r * 0.0193 + g * 0.1192 + b * 0.9505) / WHITE_POINT_Z,
  );

  return AiConsultLabDto.from(116 * y - 16, 500 * (x - y), 200 * (y - z));
}

/**
 * 고객이 쓴 색 이름을 기준 hex 로 바꾼다.
 * 표에 없는 말(브랜드 고유 색명 등)이면 null — 그 경우는 이름 매칭이 이미 처리했다.
 */
export function findBasicColorHex(normalizedQuery: string): string | null {
  return BASIC_COLOR_HEX[normalizedQuery] ?? null;
}

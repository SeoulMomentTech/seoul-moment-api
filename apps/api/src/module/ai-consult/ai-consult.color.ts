/**
 * 색상 이름을 DB 색상에 붙이는 마지막 구제 경로.
 *
 * 자모 유사도는 표기 흔들림("블랰"→"블랙")만 흡수할 수 있고, **어휘가 다른 같은 색**
 * ("빨강" vs DB 의 "레드", 유사도 0.167)은 영원히 못 붙인다. 운영 로그에서 상품 검색
 * 실패 14건 중 12건이 이 경우였다.
 *
 * 그래서 이름이 아니라 **색 자체**로 비교한다. 고객이 말한 색의 표준 hex 는 모델이
 * `colorHex` 로 주고(언어 문제), 이 파일은 그 hex 를 `option_value.color_code` 와
 * 색공간에서 견주는 일만 한다(DB 문제).
 *
 * **여기에 색 이름을 담은 표를 두지 마십시오.** 한때 "빨강→#FF0000" 표를 들고 있었는데,
 * "빨간색"은 있고 "빨강색"은 없는 식으로 표기 조합마다 구멍이 났다. 낱말은 무한하고
 * 표는 유한하다. 그 일은 모델이 한다.
 */

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
 * 75 는 "파랑→사파이어블루"(74.9)는 살리고 "초록→베이지"(78.5)는 자르는 지점이다.
 * 사파이어블루는 누가 봐도 파랑인데 상한이 70 이면 딱 잘려나갔다.
 */
export const COLOR_CHROMATIC_DELTA_E_MAX = 75;

/**
 * 무채색끼리의 거리 상한. 무채색은 사실상 명도차만 남으므로 유채색보다 좁게 잡는다.
 * 35 면 "검정→블랙·주니퍼·리드그레이·차콜"은 붙고 "검정→그레이"(54)는 떨어진다.
 */
export const COLOR_ACHROMATIC_DELTA_E_MAX = 35;

/**
 * 선명한 색끼리 허용하는 색상(Hue) 각도 차이.
 *
 * 거리만으로는 "보라→네이비"(ΔE 35)가 1위로 붙는다. 둘은 명도·채도가 비슷할 뿐
 * 색 자체가 다르므로, 색상환에서 얼마나 떨어져 있는지를 따로 본다.
 * 보라(−34°)와 네이비(−55°)는 21° 차이로 걸러지고, 라이트퍼플(−34°)은 통과한다.
 */
export const COLOR_HUE_DEGREE_MAX = 20;

/**
 * 흐린 색끼리 허용하는 색상 각도 차이.
 *
 * 채도가 낮을수록 같은 각도 차이가 눈에 덜 띈다. 20° 로 똑같이 조이면
 * "하늘→소라"(ΔE 11.5, 24.6°)처럼 **거리가 코앞인 색**이 각도 때문에 잘려나갔다.
 * 35° 면 소라·카푸치노는 붙고 "하늘→민트"(59°)는 여전히 떨어진다.
 */
export const COLOR_HUE_DEGREE_MAX_LOW_CHROMA = 35;

/**
 * 이 채도 미만이면 "흐린 색"으로 보고 각도 판정을 느슨하게 한다.
 *
 * 무채색 경계(12)와 선명한 색 사이의 중간지대다. 35 로 두면 소라(19.7)·
 * 카푸치노(22)는 완화 대상이 되고, 네이비(80)·네온옐로우(72)처럼 선명한 색은
 * 그대로 20° 판정을 받아 "보라→네이비"·"초록→네온옐로우" 오답이 유지된다.
 */
export const COLOR_HUE_RELAX_CHROMA_MAX = 35;

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
      this.hueDifferenceTo(other) <= this.hueToleranceWith(other)
    );
  }

  /**
   * 둘 중 **흐린 쪽**에 맞춘다. 한쪽이라도 흐리면 각도 차이가 그만큼 덜 보이므로,
   * 선명한 쪽 기준으로 조이면 멀쩡한 짝을 놓친다.
   */
  private hueToleranceWith(other: AiConsultLabDto): number {
    const lowerChroma = Math.min(this.getChroma(), other.getChroma());

    return lowerChroma < COLOR_HUE_RELAX_CHROMA_MAX
      ? COLOR_HUE_DEGREE_MAX_LOW_CHROMA
      : COLOR_HUE_DEGREE_MAX;
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
 * 모델이 준 색 코드를 `#RRGGBB` 로 정규화한다. 형식이 어긋나면 null.
 *
 * 모델 출력이라 `FF0000`·`#ff0000`·설명이 섞인 문자열이 올 수 있다. 형식 판정을
 * 여기 가둬 두면 색공간 쪽은 "이미 검증된 hex" 만 받는다.
 */
export function normalizeHexCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const matched = value.trim().match(HEX_PATTERN);

  return matched ? `#${matched[1].toUpperCase()}` : null;
}

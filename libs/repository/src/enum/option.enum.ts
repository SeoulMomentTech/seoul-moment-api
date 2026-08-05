export enum OptionUiType {
  GRID = 'GRID',
  RADIO = 'RADIO',
}

/**
 * `option.type` 은 자유 varchar 지만 색상 옵션은 이 값으로 약속돼 있다.
 * (product/admin 쪽에 'COLOR' 리터럴이 흩어져 있어 신규 코드는 이 상수를 쓴다)
 */
export const COLOR_OPTION_TYPE = 'COLOR';

/**
 * 상품 상태
 * - 상품군(Product) 전체의 상태를 관리
 */
export enum ProductStatus {
  NORMAL = 'NORMAL', // 정상 판매 중
  WAIT = 'WAIT', // 판매 대기 (관리자 승인 대기)
  BLOCK = 'BLOCK', // 판매 중단 (임시 차단)
  DELETE = 'DELETE', // 삭제됨 (논리적 삭제)
}

export enum ProductColorStatus {
  NORMAL = 'NORMAL', // 정상 판매 중
  WAIT = 'WAIT', // 판매 대기 (관리자 승인 대기)
  BLOCK = 'BLOCK', // 판매 중단 (임시 차단)
  DELETE = 'DELETE', // 삭제됨 (논리적 삭제)
}

/**
 * 상품 변형 상태
 * - 실제 판매 단위(ProductVariant)의 상태를 관리
 */
export enum ProductVariantStatus {
  ACTIVE = 'ACTIVE', // 활성화 (판매 가능)
  INACTIVE = 'INACTIVE', // 비활성화 (판매 중단)
  OUT_OF_STOCK = 'OUT_OF_STOCK', // 품절
  DELETE = 'DELETE', // 삭제됨 (논리적 삭제)
}

/**
 * 옵션 타입
 * - 옵션의 종류를 정의 (색상, 사이즈 등)
 */
export enum OptionType {
  COLOR = 'COLOR', // 색상 옵션
  SIZE = 'SIZE', // 사이즈 옵션
  MATERIAL = 'MATERIAL', // 소재 옵션
  FIT = 'FIT', // 핏 옵션 (슬림핏, 레귤러핏 등)
  STYLE = 'STYLE', // 스타일 옵션
}

/**
 * 상품 이미지 타입
 * - 갤러리 이미지의 용도를 구분
 */
export enum ProductImageType {
  MAIN = 'MAIN', // 메인 이미지 (갤러리 첫 번째)
  GALLERY = 'GALLERY', // 갤러리 이미지 (추가 이미지들)
  THUMBNAIL = 'THUMBNAIL', // 썸네일 이미지 (작은 미리보기)
}

/** 전자발표(電子發票) 받는 방법. 주문서에서 구매자가 고른다 */
export enum InvoiceType {
  /** ECPay 회원 載具 (CarrierType=1). 이메일·전화번호로 ECPay 가 載具를 만든다 */
  MEMBER_CARRIER = 'MEMBER_CARRIER',
  /** 휴대폰 바코드 載具 (CarrierType=3, '/' + 7자) */
  MOBILE_BARCODE = 'MOBILE_BARCODE',
  /** 自然人憑證 載具 (CarrierType=2, 영문 대문자 2 + 숫자 14) */
  CITIZEN_CERT = 'CITIZEN_CERT',
  /** 기부 (愛心碼 3–7자리) */
  DONATION = 'DONATION',
  /** 회사(統一編號). 종이 발표 대신 ECPay 회원 載具에 담고 이메일로 받는다 */
  COMPANY = 'COMPANY',
}

export enum InvoiceStatus {
  /** 결제 확정 전이거나 아직 발행 전 */
  PENDING = 'PENDING',
  ISSUED = 'ISSUED',
  /** 발행 실패. 배치가 몇 번 다시 시도한다 */
  FAILED = 'FAILED',
}

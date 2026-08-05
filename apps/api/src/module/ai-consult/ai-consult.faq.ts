import { LanguageCode } from '@app/repository/enum/language.enum';

/**
 * AI 상담이 사용하는 정적 지식 카탈로그.
 *
 * ⚠️ 아래 answer 문구의 기간·금액·조건은 **초안(placeholder)** 이다.
 *    고객에게 그대로 노출되는 계약 조건 고지이므로 배포 전 CS/법무 검수가 필수다.
 *    (전자상거래법상 표시·광고에 해당한다)
 *
 * 설계 원칙:
 * - LLM 은 faqCode 만 고르고, 이 파일의 answer 가 **한 글자도 변형 없이** 반환된다.
 *   따라서 여기 있는 문장이 곧 서비스가 고객에게 약속하는 내용이다.
 * - answer/title 은 Record<LanguageCode, string> 이라 3개 언어 누락이 컴파일 타임에 잡힌다.
 * - intent/hints 는 프롬프트 카탈로그(모델이 읽는 부분)에만 쓰이고 고객에게 노출되지 않는다.
 *   Gemini 의 크로스링구얼 매칭이 강해 한국어 intent 로 영어/중국어 질문도 매칭되므로
 *   카탈로그를 3개 언어로 만들지 않는다(input 토큰 3배 방지).
 */
export enum AiConsultFaqCode {
  // 배송
  DELIVERY_LEAD_TIME = 'DELIVERY_LEAD_TIME',
  DELIVERY_TRACKING = 'DELIVERY_TRACKING',
  DELIVERY_FEE = 'DELIVERY_FEE',
  OVERSEAS_SHIPPING = 'OVERSEAS_SHIPPING',
  CUSTOMS_DUTY = 'CUSTOMS_DUTY',
  DELIVERY_DELAY = 'DELIVERY_DELAY',

  // 환불 / 반품
  REFUND_METHOD = 'REFUND_METHOD',
  REFUND_PERIOD = 'REFUND_PERIOD',
  RETURN_CONDITION = 'RETURN_CONDITION',
  RETURN_SHIPPING_FEE = 'RETURN_SHIPPING_FEE',

  // 교환
  EXCHANGE_METHOD = 'EXCHANGE_METHOD',
  EXCHANGE_CONDITION = 'EXCHANGE_CONDITION',

  // 주문
  ORDER_CANCEL = 'ORDER_CANCEL',
  ORDER_CHANGE = 'ORDER_CHANGE',
  ORDER_STATUS_CHECK = 'ORDER_STATUS_CHECK',

  // 결제
  PAYMENT_METHOD = 'PAYMENT_METHOD',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INSTALLMENT = 'INSTALLMENT',

  // 상품 / 사이즈
  SIZE_GUIDE = 'SIZE_GUIDE',
  SIZE_EXCHANGE = 'SIZE_EXCHANGE',
  PRODUCT_QUALITY_ISSUE = 'PRODUCT_QUALITY_ISSUE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  RESTOCK_NOTICE = 'RESTOCK_NOTICE',

  // 회원
  MEMBERSHIP_JOIN = 'MEMBERSHIP_JOIN',
  MEMBERSHIP_GRADE = 'MEMBERSHIP_GRADE',
  POINT_REWARD = 'POINT_REWARD',
  COUPON_USAGE = 'COUPON_USAGE',
  ACCOUNT_DELETE = 'ACCOUNT_DELETE',

  // 기타
  CS_CONTACT = 'CS_CONTACT',
  TAX_REFUND = 'TAX_REFUND',
}

/** 매칭되는 항목이 없음을 나타내는 센티넬. responseSchema 의 required 필드는 null 을 못 쓴다. */
export const FAQ_NONE = 'NONE';

/** 고객에게 붙는 짧은 도입부. 모델은 이 중에서 "선택"만 하고 문장을 쓰지 않는다. */
export enum AiConsultPrefaceId {
  NEUTRAL = 'NEUTRAL',
  GREETING = 'GREETING',
  EMPATHY_DELAY = 'EMPATHY_DELAY',
  EMPATHY_TROUBLE = 'EMPATHY_TROUBLE',
  THANKS = 'THANKS',
}

export interface AiConsultFaqItem {
  code: AiConsultFaqCode;
  /** 프롬프트 카탈로그용 한 줄 의도 요약 (한국어) */
  intent: string;
  /** 의미 앵커. 문자열 매칭용이 아니라 모델이 표현 범위를 잡는 데 쓴다. */
  hints: string[];
  answer: Record<LanguageCode, string>;
  title: Record<LanguageCode, string>;
}

export const AI_CONSULT_FAQ: readonly AiConsultFaqItem[] = [
  {
    code: AiConsultFaqCode.DELIVERY_LEAD_TIME,
    intent: '주문 후 상품이 도착하기까지 걸리는 평균 배송 기간',
    hints: [
      '배송 얼마나',
      '며칠 걸려',
      '언제 도착',
      'how long shipping',
      '到貨時間',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '결제가 완료되면 영업일 기준 2~4일 내에 출고되고, 출고 후 배송에 2~5일이 더 걸립니다. 주문이 몰리는 시즌이나 공휴일에는 하루 이틀 늦어질 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Orders are dispatched within 2-4 business days after payment, and delivery takes another 2-5 days after dispatch. Please allow an extra day or two during peak seasons and holidays.',
      [LanguageCode.TAIWAN]:
        '付款完成後將於 2~4 個工作日內出貨，出貨後約需 2~5 天送達。訂單量大的旺季或遇假日可能延遲一至兩天。',
    },
    title: {
      [LanguageCode.KOREAN]: '배송 기간',
      [LanguageCode.ENGLISH]: 'Delivery time',
      [LanguageCode.TAIWAN]: '配送時間',
    },
  },
  {
    code: AiConsultFaqCode.DELIVERY_TRACKING,
    intent: '배송 조회 방법과 운송장 번호 확인 위치',
    hints: [
      '배송조회',
      '어디까지 왔어',
      '운송장',
      'tracking number',
      '物流查詢',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '마이페이지 > 주문 내역에서 해당 주문의 운송장 번호와 현재 배송 상태를 확인하실 수 있습니다. 출고가 완료되면 운송장 번호가 등록됩니다.',
      [LanguageCode.ENGLISH]:
        'You can check the tracking number and current delivery status under My Page > Order History. The tracking number is registered once your order has been dispatched.',
      [LanguageCode.TAIWAN]:
        '您可以在「我的帳戶 > 訂單記錄」中查看該筆訂單的物流單號與目前配送狀態。出貨完成後才會登錄物流單號。',
    },
    title: {
      [LanguageCode.KOREAN]: '배송 조회',
      [LanguageCode.ENGLISH]: 'Track my order',
      [LanguageCode.TAIWAN]: '物流查詢',
    },
  },
  {
    code: AiConsultFaqCode.DELIVERY_FEE,
    intent: '배송비 금액과 무료 배송 조건',
    hints: ['배송비', '무료배송', '얼마부터 무료', 'shipping fee', '運費'],
    answer: {
      [LanguageCode.KOREAN]:
        '기본 배송비는 주문 1건당 부과되며, 일정 금액 이상 구매 시 무료로 전환됩니다. 정확한 금액과 무료 배송 기준은 주문서 결제 화면에서 확인하실 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'A standard shipping fee applies per order, and it is waived once your order reaches the free-shipping threshold. The exact amount and threshold are shown on the checkout page.',
      [LanguageCode.TAIWAN]:
        '每筆訂單會收取基本運費，訂單金額達免運門檻時即免運費。實際金額與免運門檻請於結帳頁面確認。',
    },
    title: {
      [LanguageCode.KOREAN]: '배송비',
      [LanguageCode.ENGLISH]: 'Shipping fee',
      [LanguageCode.TAIWAN]: '運費',
    },
  },
  {
    code: AiConsultFaqCode.OVERSEAS_SHIPPING,
    intent: '해외 배송 가능 국가와 해외 배송 소요 기간',
    hints: [
      '해외배송',
      '대만으로',
      '국제배송',
      'international shipping',
      '海外配送',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '해외 배송이 가능하며, 국가와 통관 상황에 따라 출고 후 5~14일이 소요됩니다. 배송 가능 국가와 국가별 배송비는 주문서 화면에서 확인하실 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'We do ship internationally. Delivery takes 5-14 days after dispatch depending on the destination and customs processing. Available countries and rates are shown at checkout.',
      [LanguageCode.TAIWAN]:
        '我們提供海外配送，依國家與通關情況，出貨後約需 5~14 天。可配送國家與各國運費請於結帳頁面確認。',
    },
    title: {
      [LanguageCode.KOREAN]: '해외 배송',
      [LanguageCode.ENGLISH]: 'International shipping',
      [LanguageCode.TAIWAN]: '海外配送',
    },
  },
  {
    code: AiConsultFaqCode.CUSTOMS_DUTY,
    intent: '해외 배송 시 관세와 통관 절차, 부가세 부담 주체',
    hints: ['관세', '통관', '세금 내야', 'customs duty', '關稅', '報關'],
    answer: {
      [LanguageCode.KOREAN]:
        '해외 배송 상품의 관세와 수입 부가세는 현지 규정에 따라 수취인께 부과될 수 있으며, 상품 금액에 포함되어 있지 않습니다. 부과 기준은 국가별로 다르므로 현지 세관 규정을 확인해 주세요.',
      [LanguageCode.ENGLISH]:
        'Customs duties and import taxes on international orders may be charged to the recipient under local regulations and are not included in the product price. Thresholds vary by country, so please check your local customs rules.',
      [LanguageCode.TAIWAN]:
        '海外訂單的關稅與進口稅可能依當地法規向收件人徵收，並未包含在商品金額中。課稅標準因國家而異，請確認當地海關規定。',
    },
    title: {
      [LanguageCode.KOREAN]: '관세 · 통관',
      [LanguageCode.ENGLISH]: 'Customs & duties',
      [LanguageCode.TAIWAN]: '關稅與通關',
    },
  },
  {
    code: AiConsultFaqCode.DELIVERY_DELAY,
    intent: '배송이 예정보다 지연될 때의 사유와 대응 방법',
    hints: ['배송 늦어', '아직 안 왔어', '지연', 'delayed', '還沒到', '延遲'],
    answer: {
      [LanguageCode.KOREAN]:
        '주문 폭주, 기상 악화, 통관 지연 등으로 예정보다 늦어질 수 있습니다. 마이페이지 > 주문 내역에서 최신 배송 상태를 먼저 확인해 주시고, 안내된 기간을 넘겼다면 고객센터로 주문번호와 함께 문의해 주세요.',
      [LanguageCode.ENGLISH]:
        'Delays can happen due to high order volume, bad weather, or customs processing. Please check the latest status under My Page > Order History first, and if it has passed the stated period, contact our customer service with your order number.',
      [LanguageCode.TAIWAN]:
        '訂單量大、天候不佳或通關延誤都可能造成延遲。請先於「我的帳戶 > 訂單記錄」確認最新配送狀態，若已超過公告期間，請提供訂單編號聯繫客服。',
    },
    title: {
      [LanguageCode.KOREAN]: '배송 지연',
      [LanguageCode.ENGLISH]: 'Delivery delay',
      [LanguageCode.TAIWAN]: '配送延遲',
    },
  },
  {
    code: AiConsultFaqCode.REFUND_METHOD,
    intent: '환불 신청 방법과 환불 처리 절차',
    hints: ['환불 어떻게', '환불 신청', '돈 돌려', 'refund', '退款方式'],
    answer: {
      [LanguageCode.KOREAN]:
        '마이페이지 > 주문 내역에서 해당 상품의 반품·환불 신청 버튼을 눌러 접수하실 수 있습니다. 상품이 회수되어 검수가 완료되면 환불이 진행되며, 결제하신 수단으로 되돌려 드립니다.',
      [LanguageCode.ENGLISH]:
        'You can request a return/refund from My Page > Order History using the button on the relevant item. Once the item is collected and inspected, the refund is issued back to your original payment method.',
      [LanguageCode.TAIWAN]:
        '請於「我的帳戶 > 訂單記錄」點選該商品的退貨/退款申請按鈕提出申請。商品回收並檢驗完成後即進行退款，並退回您原本的付款方式。',
    },
    title: {
      [LanguageCode.KOREAN]: '환불 방법',
      [LanguageCode.ENGLISH]: 'How to get a refund',
      [LanguageCode.TAIWAN]: '退款方式',
    },
  },
  {
    code: AiConsultFaqCode.REFUND_PERIOD,
    intent: '환불 금액이 실제로 입금되기까지 걸리는 기간',
    hints: [
      '환불 언제',
      '환불 며칠',
      '입금 안 됐어',
      'refund take',
      '退款要多久',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '상품 검수가 끝나면 영업일 기준 3~5일 내에 환불 처리가 완료됩니다. 카드 결제의 경우 카드사 사정에 따라 취소 내역이 반영되는 데 며칠이 더 걸릴 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Refunds are completed within 3-5 business days after the returned item passes inspection. For card payments, it may take a few extra days for your card issuer to reflect the cancellation.',
      [LanguageCode.TAIWAN]:
        '商品檢驗完成後，將於 3~5 個工作日內完成退款。信用卡付款者，依發卡機構作業時間，帳單上顯示取消紀錄可能需要額外幾天。',
    },
    title: {
      [LanguageCode.KOREAN]: '환불 소요 기간',
      [LanguageCode.ENGLISH]: 'Refund timeline',
      [LanguageCode.TAIWAN]: '退款時間',
    },
  },
  {
    code: AiConsultFaqCode.RETURN_CONDITION,
    intent: '반품이 가능한 기간과 반품 불가 조건',
    hints: [
      '반품 가능',
      '반품 조건',
      '며칠 안에 반품',
      'return policy',
      '退貨條件',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '상품 수령 후 7일 이내에 반품 신청이 가능합니다. 다만 착용·세탁·훼손된 상품, 택이나 부속품이 없는 상품, 개봉 시 가치가 훼손되는 상품은 반품이 어렵습니다.',
      [LanguageCode.ENGLISH]:
        'You may request a return within 7 days of receiving your order. Items that have been worn, washed or damaged, items missing tags or accessories, and items whose value is lost once opened cannot be returned.',
      [LanguageCode.TAIWAN]:
        '收到商品後 7 天內可申請退貨。惟已穿著、洗滌或毀損的商品、缺少吊牌或配件的商品，以及開封後價值受損的商品恕無法退貨。',
    },
    title: {
      [LanguageCode.KOREAN]: '반품 조건',
      [LanguageCode.ENGLISH]: 'Return policy',
      [LanguageCode.TAIWAN]: '退貨條件',
    },
  },
  {
    code: AiConsultFaqCode.RETURN_SHIPPING_FEE,
    intent: '반품 배송비를 누가 부담하는지',
    hints: ['반품비', '반품 배송비 누가', 'return shipping cost', '退貨運費'],
    answer: {
      [LanguageCode.KOREAN]:
        '단순 변심으로 반품하시는 경우 왕복 배송비는 고객님 부담입니다. 상품 불량이나 오배송처럼 판매자 책임인 경우에는 배송비를 부담하지 않으셔도 됩니다.',
      [LanguageCode.ENGLISH]:
        'For returns due to a change of mind, the round-trip shipping cost is covered by the customer. If the return is our fault — a defective or incorrect item — you do not pay any shipping cost.',
      [LanguageCode.TAIWAN]:
        '若因個人因素退貨，來回運費由客戶負擔。若屬商品瑕疵或錯誤出貨等賣方責任，則無需負擔運費。',
    },
    title: {
      [LanguageCode.KOREAN]: '반품 배송비',
      [LanguageCode.ENGLISH]: 'Return shipping cost',
      [LanguageCode.TAIWAN]: '退貨運費',
    },
  },
  {
    code: AiConsultFaqCode.EXCHANGE_METHOD,
    intent: '교환 신청 방법과 교환 처리 절차',
    hints: ['교환 어떻게', '교환 신청', 'exchange', '換貨方式'],
    answer: {
      [LanguageCode.KOREAN]:
        '마이페이지 > 주문 내역에서 교환 신청을 접수해 주세요. 기존 상품이 회수되어 검수가 끝나면 교환 상품이 다시 출고됩니다. 교환하실 옵션의 재고가 없는 경우에는 환불로 안내드립니다.',
      [LanguageCode.ENGLISH]:
        'Please submit an exchange request from My Page > Order History. Once the original item is collected and inspected, the replacement is dispatched. If the option you want is out of stock, we will process a refund instead.',
      [LanguageCode.TAIWAN]:
        '請於「我的帳戶 > 訂單記錄」提出換貨申請。原商品回收並檢驗完成後即會寄出換貨商品。若您欲更換的款式無庫存，將改以退款處理。',
    },
    title: {
      [LanguageCode.KOREAN]: '교환 방법',
      [LanguageCode.ENGLISH]: 'How to exchange',
      [LanguageCode.TAIWAN]: '換貨方式',
    },
  },
  {
    code: AiConsultFaqCode.EXCHANGE_CONDITION,
    intent: '교환이 가능한 기간과 교환 불가 조건',
    hints: [
      '교환 가능',
      '교환 조건',
      '교환 기간',
      'exchange policy',
      '換貨條件',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '상품 수령 후 7일 이내, 상품과 택·부속품이 처음 상태로 보존된 경우에 교환이 가능합니다. 착용이나 세탁을 하신 상품, 고객님 사용으로 훼손된 상품은 교환이 어렵습니다.',
      [LanguageCode.ENGLISH]:
        'Exchanges are available within 7 days of delivery, provided the item, tags and accessories are in their original condition. Items that have been worn or washed, or damaged through use, cannot be exchanged.',
      [LanguageCode.TAIWAN]:
        '收到商品後 7 天內，且商品與吊牌、配件保持原始狀態者可辦理換貨。已穿著或洗滌、因使用而毀損的商品恕無法換貨。',
    },
    title: {
      [LanguageCode.KOREAN]: '교환 조건',
      [LanguageCode.ENGLISH]: 'Exchange policy',
      [LanguageCode.TAIWAN]: '換貨條件',
    },
  },
  {
    code: AiConsultFaqCode.ORDER_CANCEL,
    intent: '주문 취소가 가능한 시점과 취소 방법',
    hints: ['주문 취소', '취소하고 싶어', 'cancel order', '取消訂單'],
    answer: {
      [LanguageCode.KOREAN]:
        '출고 준비 전이라면 마이페이지 > 주문 내역에서 바로 취소하실 수 있습니다. 이미 출고된 뒤에는 취소가 불가능하므로, 상품을 받으신 후 반품으로 접수해 주세요.',
      [LanguageCode.ENGLISH]:
        'If your order has not yet entered dispatch preparation, you can cancel it directly from My Page > Order History. Once it has shipped, cancellation is no longer possible — please request a return after receiving the item.',
      [LanguageCode.TAIWAN]:
        '若訂單尚未進入出貨準備，可直接於「我的帳戶 > 訂單記錄」取消。已出貨後無法取消，請於收到商品後改以退貨方式申請。',
    },
    title: {
      [LanguageCode.KOREAN]: '주문 취소',
      [LanguageCode.ENGLISH]: 'Cancel an order',
      [LanguageCode.TAIWAN]: '取消訂單',
    },
  },
  {
    code: AiConsultFaqCode.ORDER_CHANGE,
    intent: '주문 후 배송지나 옵션을 변경하는 방법',
    hints: [
      '주소 변경',
      '옵션 바꾸',
      '주문 변경',
      'change address',
      '修改訂單',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '출고 전이라면 고객센터로 주문번호와 함께 문의해 주시면 배송지 변경을 도와드립니다. 상품 옵션 변경은 주문 취소 후 재주문하시는 편이 가장 빠릅니다.',
      [LanguageCode.ENGLISH]:
        'Before dispatch, contact our customer service with your order number and we will help change the delivery address. To change a product option, cancelling and reordering is usually the fastest route.',
      [LanguageCode.TAIWAN]:
        '出貨前請提供訂單編號聯繫客服，我們會協助變更配送地址。若要變更商品款式，建議取消訂單後重新下單最為快速。',
    },
    title: {
      [LanguageCode.KOREAN]: '주문 정보 변경',
      [LanguageCode.ENGLISH]: 'Change order details',
      [LanguageCode.TAIWAN]: '修改訂單資訊',
    },
  },
  {
    code: AiConsultFaqCode.ORDER_STATUS_CHECK,
    intent: '주문 내역과 주문 처리 상태를 확인하는 방법',
    hints: ['주문 확인', '주문 내역', '결제 됐나', 'order status', '訂單狀態'],
    answer: {
      [LanguageCode.KOREAN]:
        '마이페이지 > 주문 내역에서 결제 완료, 출고 준비, 배송 중, 배송 완료 등 현재 처리 상태를 확인하실 수 있습니다. 비회원으로 주문하신 경우 주문번호로 조회해 주세요.',
      [LanguageCode.ENGLISH]:
        'My Page > Order History shows the current status of each order — payment completed, preparing for dispatch, in transit, or delivered. If you ordered as a guest, please look it up with your order number.',
      [LanguageCode.TAIWAN]:
        '您可在「我的帳戶 > 訂單記錄」查看付款完成、準備出貨、配送中、已送達等目前處理狀態。若以非會員身分下單，請使用訂單編號查詢。',
    },
    title: {
      [LanguageCode.KOREAN]: '주문 상태 확인',
      [LanguageCode.ENGLISH]: 'Check order status',
      [LanguageCode.TAIWAN]: '查看訂單狀態',
    },
  },
  {
    code: AiConsultFaqCode.PAYMENT_METHOD,
    intent: '사용 가능한 결제 수단',
    hints: [
      '결제 수단',
      '어떤 카드',
      '페이 되나',
      'payment methods',
      '付款方式',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '신용·체크카드와 간편결제를 지원하며, 사용 가능한 결제 수단은 주문서 결제 화면에 표시됩니다. 해외 발행 카드는 카드사 정책에 따라 승인이 제한될 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'We accept credit/debit cards and simple-pay services; the available options are listed on the checkout page. Cards issued overseas may be declined depending on the issuer’s policy.',
      [LanguageCode.TAIWAN]:
        '我們支援信用卡/金融卡與行動支付，可用的付款方式會顯示於結帳頁面。海外發行的卡片可能因發卡機構政策而無法授權。',
    },
    title: {
      [LanguageCode.KOREAN]: '결제 수단',
      [LanguageCode.ENGLISH]: 'Payment methods',
      [LanguageCode.TAIWAN]: '付款方式',
    },
  },
  {
    code: AiConsultFaqCode.PAYMENT_FAILED,
    intent: '결제가 실패하거나 승인되지 않을 때의 확인 사항',
    hints: [
      '결제 안 돼',
      '결제 실패',
      '승인 거절',
      'payment failed',
      '付款失敗',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '카드 한도, 해외 결제 차단 설정, 카드 정보 입력 오류를 먼저 확인해 주세요. 그래도 결제가 되지 않으면 다른 결제 수단을 이용해 보시고, 계속 실패하면 고객센터로 문의해 주세요.',
      [LanguageCode.ENGLISH]:
        'Please first check your card limit, any block on overseas payments, and whether the card details were entered correctly. If it still fails, try another payment method and contact our customer service if the problem persists.',
      [LanguageCode.TAIWAN]:
        '請先確認信用卡額度、是否設定禁止海外交易，以及卡片資訊是否輸入正確。若仍無法付款，請嘗試其他付款方式；持續失敗請聯繫客服。',
    },
    title: {
      [LanguageCode.KOREAN]: '결제 실패',
      [LanguageCode.ENGLISH]: 'Payment failed',
      [LanguageCode.TAIWAN]: '付款失敗',
    },
  },
  {
    code: AiConsultFaqCode.INSTALLMENT,
    intent: '할부 결제와 무이자 할부 가능 여부',
    hints: ['할부', '무이자', 'installment', '分期', '免利息'],
    answer: {
      [LanguageCode.KOREAN]:
        '할부 개월 수와 무이자 여부는 카드사 정책에 따라 결정되며, 결제 화면에서 선택 가능한 조건이 표시됩니다. 무이자 행사 여부는 카드사 공지를 확인해 주세요.',
      [LanguageCode.ENGLISH]:
        'Available instalment terms and interest-free options are determined by your card issuer and shown on the checkout page. Please check your issuer’s announcements for current interest-free promotions.',
      [LanguageCode.TAIWAN]:
        '分期期數與是否免利息由發卡機構政策決定，可選擇的條件會顯示於結帳頁面。免利息活動請確認發卡機構公告。',
    },
    title: {
      [LanguageCode.KOREAN]: '할부 결제',
      [LanguageCode.ENGLISH]: 'Instalment payment',
      [LanguageCode.TAIWAN]: '分期付款',
    },
  },
  {
    code: AiConsultFaqCode.SIZE_GUIDE,
    intent: '사이즈 표 확인 방법과 사이즈 선택 기준',
    hints: ['사이즈', '몇 사이즈', '치수', '핏', 'size chart', '尺寸'],
    answer: {
      [LanguageCode.KOREAN]:
        '각 상품 상세 페이지의 사이즈 정보에서 실측 치수를 확인하실 수 있습니다. 브랜드마다 기준이 조금씩 다르므로, 평소 입는 옷의 실측과 비교해 선택하시는 편이 가장 정확합니다.',
      [LanguageCode.ENGLISH]:
        'Actual measurements are listed in the size information on each product page. Sizing differs slightly between brands, so comparing with a garment you already own gives the most accurate result.',
      [LanguageCode.TAIWAN]:
        '各商品詳情頁的尺寸資訊中可查看實際尺寸。各品牌的版型略有差異，建議與您平常穿著的衣物實測尺寸比較最為準確。',
    },
    title: {
      [LanguageCode.KOREAN]: '사이즈 확인',
      [LanguageCode.ENGLISH]: 'Size guide',
      [LanguageCode.TAIWAN]: '尺寸指南',
    },
  },
  {
    code: AiConsultFaqCode.SIZE_EXCHANGE,
    intent: '사이즈가 맞지 않을 때 다른 사이즈로 교환하는 방법',
    hints: [
      '사이즈 안 맞아',
      '사이즈 교환',
      '더 큰 걸로',
      'wrong size',
      '尺寸不合',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '수령 후 7일 이내에 마이페이지 > 주문 내역에서 사이즈 교환을 신청해 주세요. 단순 변심에 해당하므로 왕복 배송비가 발생하며, 원하시는 사이즈의 재고가 없으면 환불로 안내드립니다.',
      [LanguageCode.ENGLISH]:
        'Please request a size exchange from My Page > Order History within 7 days of delivery. As this counts as a change of mind, round-trip shipping applies; if the size you want is out of stock we will process a refund instead.',
      [LanguageCode.TAIWAN]:
        '請於收到商品後 7 天內，在「我的帳戶 > 訂單記錄」申請尺寸換貨。此屬個人因素，需負擔來回運費；若您需要的尺寸無庫存，將改以退款處理。',
    },
    title: {
      [LanguageCode.KOREAN]: '사이즈 교환',
      [LanguageCode.ENGLISH]: 'Size exchange',
      [LanguageCode.TAIWAN]: '尺寸換貨',
    },
  },
  {
    code: AiConsultFaqCode.PRODUCT_QUALITY_ISSUE,
    intent: '상품 불량, 오배송, 파손 등 상품 하자 신고 방법',
    hints: ['불량', '하자', '찢어져', '다른 상품이 왔어', 'defective', '瑕疵'],
    answer: {
      [LanguageCode.KOREAN]:
        '불편을 드려 죄송합니다. 마이페이지 > 주문 내역에서 반품·교환을 접수하시고 하자 부위 사진을 함께 첨부해 주세요. 판매자 책임으로 확인되면 배송비 부담 없이 교환 또는 환불로 처리해 드립니다.',
      [LanguageCode.ENGLISH]:
        'We are sorry for the trouble. Please submit a return/exchange request from My Page > Order History and attach photos of the issue. Once confirmed as our fault, we will exchange or refund the item at no shipping cost to you.',
      [LanguageCode.TAIWAN]:
        '造成您的不便，我們深感抱歉。請於「我的帳戶 > 訂單記錄」提出退貨/換貨申請，並附上瑕疵部位照片。經確認屬賣方責任者，將不收取運費並為您換貨或退款。',
    },
    title: {
      [LanguageCode.KOREAN]: '상품 하자 신고',
      [LanguageCode.ENGLISH]: 'Report a defect',
      [LanguageCode.TAIWAN]: '商品瑕疵回報',
    },
  },
  {
    code: AiConsultFaqCode.OUT_OF_STOCK,
    intent: '품절된 상품과 재고 부족에 대한 안내',
    hints: ['품절', '재고 없', '살 수 없', 'sold out', '缺貨'],
    answer: {
      [LanguageCode.KOREAN]:
        '상품 상세 페이지에서 선택할 수 없는 옵션은 현재 품절 상태입니다. 재입고는 브랜드 상황에 따라 결정되며, 재입고 알림을 신청해 두시면 다시 입고될 때 안내드립니다.',
      [LanguageCode.ENGLISH]:
        'Options that cannot be selected on the product page are currently sold out. Restocking depends on the brand, so we recommend setting a restock alert to be notified when the item is available again.',
      [LanguageCode.TAIWAN]:
        '商品詳情頁中無法選擇的款式表示目前缺貨。是否補貨依品牌狀況而定，建議您申請補貨通知，到貨時我們會通知您。',
    },
    title: {
      [LanguageCode.KOREAN]: '품절 안내',
      [LanguageCode.ENGLISH]: 'Sold out',
      [LanguageCode.TAIWAN]: '缺貨說明',
    },
  },
  {
    code: AiConsultFaqCode.RESTOCK_NOTICE,
    intent: '재입고 알림 신청 방법',
    hints: [
      '재입고',
      '언제 들어와',
      '알림 받고 싶어',
      'restock alert',
      '補貨通知',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '상품 상세 페이지에서 원하시는 옵션을 선택하고 재입고 알림을 신청하시면, 해당 옵션이 다시 입고될 때 알려드립니다. 재입고 일정은 미리 확정해 드리기 어렵습니다.',
      [LanguageCode.ENGLISH]:
        'Select the option you want on the product page and set a restock alert — we will notify you as soon as it is back in stock. Unfortunately we cannot confirm restock dates in advance.',
      [LanguageCode.TAIWAN]:
        '請於商品詳情頁選擇您需要的款式並申請補貨通知，該款式再次到貨時我們會通知您。補貨時間恕無法事先確定。',
    },
    title: {
      [LanguageCode.KOREAN]: '재입고 알림',
      [LanguageCode.ENGLISH]: 'Restock alert',
      [LanguageCode.TAIWAN]: '補貨通知',
    },
  },
  {
    code: AiConsultFaqCode.MEMBERSHIP_JOIN,
    intent: '회원가입 방법과 가입 혜택',
    hints: ['회원가입', '가입 어떻게', '로그인 안 돼', 'sign up', '註冊會員'],
    answer: {
      [LanguageCode.KOREAN]:
        '홈 화면 우측 상단의 회원가입에서 이메일 또는 소셜 계정으로 가입하실 수 있습니다. 가입 후에는 주문 내역 조회, 적립금, 쿠폰 등 회원 혜택을 이용하실 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'You can sign up with an email address or a social account from the Sign Up link at the top right of the home page. Membership gives you access to order history, reward points and coupons.',
      [LanguageCode.TAIWAN]:
        '請由首頁右上角的「註冊會員」，以電子郵件或社群帳號註冊。註冊後即可使用訂單查詢、購物金、優惠券等會員權益。',
    },
    title: {
      [LanguageCode.KOREAN]: '회원가입',
      [LanguageCode.ENGLISH]: 'Sign up',
      [LanguageCode.TAIWAN]: '註冊會員',
    },
  },
  {
    code: AiConsultFaqCode.MEMBERSHIP_GRADE,
    intent: '회원 등급 기준과 등급별 혜택',
    hints: ['회원 등급', '등급 올리', 'VIP', 'membership tier', '會員等級'],
    answer: {
      [LanguageCode.KOREAN]:
        '회원 등급은 일정 기간의 구매 실적에 따라 산정되며, 등급별로 적립률과 쿠폰 혜택이 달라집니다. 현재 등급과 다음 등급 조건은 마이페이지에서 확인하실 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Membership tiers are calculated from your purchases over a set period, and each tier has different reward rates and coupon benefits. Your current tier and the requirements for the next one are shown on My Page.',
      [LanguageCode.TAIWAN]:
        '會員等級依一定期間內的消費紀錄計算，各等級的回饋比例與優惠券權益不同。目前等級與升級條件請於「我的帳戶」查看。',
    },
    title: {
      [LanguageCode.KOREAN]: '회원 등급',
      [LanguageCode.ENGLISH]: 'Membership tiers',
      [LanguageCode.TAIWAN]: '會員等級',
    },
  },
  {
    code: AiConsultFaqCode.POINT_REWARD,
    intent: '적립금 적립 기준과 사용 방법',
    hints: ['적립금', '포인트', '적립 언제', 'reward points', '購物金'],
    answer: {
      [LanguageCode.KOREAN]:
        '적립금은 구매 확정 후 회원 등급별 적립률에 따라 지급되며, 다음 주문의 결제 화면에서 사용하실 수 있습니다. 보유 적립금과 소멸 예정일은 마이페이지에서 확인해 주세요.',
      [LanguageCode.ENGLISH]:
        'Reward points are credited after your purchase is confirmed, at the rate for your membership tier, and can be applied at checkout on your next order. Your balance and expiry dates are shown on My Page.',
      [LanguageCode.TAIWAN]:
        '購物金於確認收貨後依會員等級回饋比例發放，可在下次訂單的結帳頁面折抵使用。持有金額與失效日期請於「我的帳戶」查看。',
    },
    title: {
      [LanguageCode.KOREAN]: '적립금',
      [LanguageCode.ENGLISH]: 'Reward points',
      [LanguageCode.TAIWAN]: '購物金',
    },
  },
  {
    code: AiConsultFaqCode.COUPON_USAGE,
    intent: '쿠폰 사용 방법과 쿠폰이 적용되지 않는 경우',
    hints: ['쿠폰', '할인 코드', '쿠폰 적용 안 돼', 'coupon', '優惠券'],
    answer: {
      [LanguageCode.KOREAN]:
        '결제 화면의 쿠폰 적용란에서 보유 쿠폰을 선택하실 수 있습니다. 쿠폰마다 최소 주문 금액, 사용 기한, 적용 대상 상품이 정해져 있어 조건이 맞지 않으면 적용되지 않습니다.',
      [LanguageCode.ENGLISH]:
        'You can select your coupons in the coupon field at checkout. Each coupon has its own minimum order amount, validity period and eligible products, so it will not apply if those conditions are not met.',
      [LanguageCode.TAIWAN]:
        '您可在結帳頁面的優惠券欄位選擇持有的優惠券。每張優惠券各有最低訂單金額、使用期限與適用商品，未符合條件時將無法套用。',
    },
    title: {
      [LanguageCode.KOREAN]: '쿠폰 사용',
      [LanguageCode.ENGLISH]: 'Using coupons',
      [LanguageCode.TAIWAN]: '使用優惠券',
    },
  },
  {
    code: AiConsultFaqCode.ACCOUNT_DELETE,
    intent: '회원 탈퇴 방법과 탈퇴 시 데이터 처리',
    hints: ['탈퇴', '계정 삭제', 'delete account', '刪除帳號', '退出會員'],
    answer: {
      [LanguageCode.KOREAN]:
        '마이페이지 > 설정에서 회원 탈퇴를 진행하실 수 있습니다. 탈퇴하시면 보유 적립금과 쿠폰은 소멸되며 복구되지 않고, 관련 법령에 따라 보관이 필요한 거래 기록은 일정 기간 보존됩니다.',
      [LanguageCode.ENGLISH]:
        'You can close your account under My Page > Settings. Any remaining reward points and coupons are forfeited and cannot be restored, and transaction records required by law are retained for the statutory period.',
      [LanguageCode.TAIWAN]:
        '您可於「我的帳戶 > 設定」辦理退出會員。退出後持有的購物金與優惠券將失效且無法恢復，依相關法規需保存的交易紀錄將保留一定期間。',
    },
    title: {
      [LanguageCode.KOREAN]: '회원 탈퇴',
      [LanguageCode.ENGLISH]: 'Close account',
      [LanguageCode.TAIWAN]: '退出會員',
    },
  },
  {
    code: AiConsultFaqCode.CS_CONTACT,
    intent: '고객센터 연락 방법과 상담 운영 시간',
    hints: ['고객센터', '상담원', '전화', '문의', 'contact', '客服'],
    answer: {
      [LanguageCode.KOREAN]:
        '고객센터는 평일 영업시간에 운영되며, 사이트 하단의 문의하기 또는 고객센터 이메일로 접수해 주시면 순차적으로 답변드립니다. 주문 관련 문의는 주문번호를 함께 남겨 주시면 더 빠르게 확인할 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Our customer service operates during business hours on weekdays. Please use the Contact Us link at the bottom of the site or email us, and we will reply in order of receipt. Including your order number helps us respond faster.',
      [LanguageCode.TAIWAN]:
        '客服於平日營業時間服務。請透過網站下方的「聯絡我們」或客服信箱與我們聯繫，我們會依序回覆。訂單相關問題請一併提供訂單編號，以便更快確認。',
    },
    title: {
      [LanguageCode.KOREAN]: '고객센터 문의',
      [LanguageCode.ENGLISH]: 'Contact us',
      [LanguageCode.TAIWAN]: '聯絡客服',
    },
  },
  {
    code: AiConsultFaqCode.TAX_REFUND,
    intent: '세금 환급과 부가세 영수증, 증빙 서류 발급',
    hints: [
      '세금 환급',
      '영수증',
      '증빙',
      'tax refund',
      'invoice',
      '發票',
      '退稅',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '주문 관련 영수증과 증빙 서류는 마이페이지 > 주문 내역에서 확인하실 수 있습니다. 그 밖에 세금 환급이나 별도 증빙이 필요하신 경우 주문번호와 함께 고객센터로 문의해 주세요.',
      [LanguageCode.ENGLISH]:
        'Receipts and supporting documents for your order are available under My Page > Order History. For tax refunds or any other documentation, please contact our customer service with your order number.',
      [LanguageCode.TAIWAN]:
        '訂單相關收據與憑證可於「我的帳戶 > 訂單記錄」查看。若需退稅或其他證明文件，請提供訂單編號聯繫客服。',
    },
    title: {
      [LanguageCode.KOREAN]: '영수증 · 세금 환급',
      [LanguageCode.ENGLISH]: 'Receipts & tax refund',
      [LanguageCode.TAIWAN]: '收據與退稅',
    },
  },
];

export const PREFACES: Record<
  AiConsultPrefaceId,
  Record<LanguageCode, string>
> = {
  [AiConsultPrefaceId.NEUTRAL]: {
    [LanguageCode.KOREAN]: '',
    [LanguageCode.ENGLISH]: '',
    [LanguageCode.TAIWAN]: '',
  },
  [AiConsultPrefaceId.GREETING]: {
    [LanguageCode.KOREAN]: '안녕하세요! ',
    [LanguageCode.ENGLISH]: 'Hello! ',
    [LanguageCode.TAIWAN]: '您好！',
  },
  [AiConsultPrefaceId.EMPATHY_DELAY]: {
    [LanguageCode.KOREAN]: '기다리시게 해서 죄송해요. ',
    [LanguageCode.ENGLISH]: 'Sorry to keep you waiting. ',
    [LanguageCode.TAIWAN]: '讓您等待，很抱歉。',
  },
  [AiConsultPrefaceId.EMPATHY_TROUBLE]: {
    [LanguageCode.KOREAN]: '불편을 드려 죄송합니다. ',
    [LanguageCode.ENGLISH]: 'We are sorry for the inconvenience. ',
    [LanguageCode.TAIWAN]: '造成您的不便，我們深感抱歉。',
  },
  [AiConsultPrefaceId.THANKS]: {
    [LanguageCode.KOREAN]: '문의해 주셔서 감사합니다. ',
    [LanguageCode.ENGLISH]: 'Thank you for reaching out. ',
    [LanguageCode.TAIWAN]: '感謝您的詢問。',
  },
};

/** 쇼핑몰과 무관한 질문 / 프롬프트 인젝션 — 두 경우에 같은 응답을 준다. */
export const AI_CONSULT_OFF_TOPIC_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '죄송해요, 저는 서울 모먼트 쇼핑 관련 문의(주문·배송·교환·환불·사이즈 등)만 도와드릴 수 있어요. 궁금한 점을 다시 알려주시겠어요?',
  [LanguageCode.ENGLISH]:
    'Sorry, I can only help with Seoul Moment shopping questions such as orders, delivery, exchanges, refunds and sizing. Could you rephrase your question?',
  [LanguageCode.TAIWAN]:
    '抱歉，我僅能協助 Seoul Moment 的購物相關問題（訂單、配送、換貨、退款、尺寸等）。可以請您重新描述問題嗎？',
};

/** FAQ 매칭 실패 — 고객센터로 유도한다. */
export const AI_CONSULT_FALLBACK_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '죄송해요, 문의하신 내용을 정확히 이해하지 못했어요. 아래 자주 찾는 질문에서 골라 보시거나, 조금 더 자세히 말씀해 주시겠어요? 급하신 경우 고객센터로 문의해 주세요.',
  [LanguageCode.ENGLISH]:
    'Sorry, I could not quite understand your question. Please pick one of the common topics below or describe your question in a little more detail. If it is urgent, please contact our customer service.',
  [LanguageCode.TAIWAN]:
    '抱歉，我未能完全理解您的問題。請從下方常見問題中選擇，或再詳細描述一些。若情況緊急，請聯繫客服。',
};

/** 애매한 매칭 — 되묻는다. {title} 은 매칭 후보 제목으로 치환된다. */
export const AI_CONSULT_CONFIRM_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '혹시 "{title}"에 대해 궁금하신가요? 아래에서 골라 주시면 정확하게 안내드릴게요.',
  [LanguageCode.ENGLISH]:
    'Did you mean "{title}"? Please pick from the options below and I will give you the exact answer.',
  [LanguageCode.TAIWAN]:
    '請問您是想了解「{title}」嗎？請從下方選擇，我將為您提供準確的說明。',
};

/**
 * 입점 브랜드 목록 안내. {count} 는 DB 에서 읽은 실제 건수로 치환된다.
 * 브랜드 이름 자체는 이 문구에 들어가지 않고 응답의 brands 배열로 나간다.
 */
export const AI_CONSULT_BRAND_LIST_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '현재 서울 모먼트에는 {count}개 브랜드가 입점해 있어요. 아래에서 확인해 보세요.',
  [LanguageCode.ENGLISH]:
    'Seoul Moment currently features {count} brands. Take a look below.',
  [LanguageCode.TAIWAN]:
    '目前 Seoul Moment 有 {count} 個品牌進駐，請參考以下清單。',
};

/**
 * 대분류 목록 안내. {count} 는 DB 에서 읽은 실제 건수로 치환된다.
 * 카테고리 이름은 이 문구가 아니라 응답의 categories 배열로 나간다.
 */
/**
 * 이해는 했지만 취급하지 않는 것을 물었을 때.
 *
 * 고객이 쓴 말을 되풀이하지 않는다 — categoryQuery 는 모델 출력이라 그대로
 * 문장에 넣으면 인젝션 문구가 고객 화면에 그대로 찍힐 수 있다.
 * 없다는 사실만 말하고 끝낸다.
 */
export const AI_CONSULT_NOT_FOUND_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '찾으시는 상품은 아직 서울 모먼트에서 취급하지 않아요.',
  [LanguageCode.ENGLISH]:
    'We do not carry what you are looking for at Seoul Moment yet.',
  [LanguageCode.TAIWAN]: '您想找的商品目前 Seoul Moment 尚未販售。',
};

/**
 * 상품 검색 결과.
 *
 * {filter} 에는 **DB 에서 읽은** 조건 이름만 들어간다(예: "검정", "패션 · 검정").
 * 모델이 뱉은 문자열은 절대 들어가지 않는다.
 */
export const AI_CONSULT_PRODUCT_LIST_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]: '{filter} 상품 {count}개를 찾았어요.',
  [LanguageCode.ENGLISH]: 'I found {count} items matching {filter}.',
  [LanguageCode.TAIWAN]: '為您找到 {filter} 商品 {count} 件。',
};

/** 상품명 검색어만 걸렸을 때. 검색어는 모델 출력이라 문장에 넣지 않는다. */
export const AI_CONSULT_PRODUCT_FOUND_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]: '말씀하신 상품 {count}개를 찾았어요.',
  [LanguageCode.ENGLISH]: 'I found {count} items matching your search.',
  [LanguageCode.TAIWAN]: '為您找到 {count} 件相關商品。',
};

/** 조건 없이 그냥 추천해 달라고 했을 때. */
export const AI_CONSULT_PRODUCT_PICK_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]: '최근 들어온 상품이에요. 이런 건 어떠세요?',
  [LanguageCode.ENGLISH]:
    'Here are some of our newest arrivals. How about these?',
  [LanguageCode.TAIWAN]: '這些是最新上架的商品，您覺得如何？',
};

/** 조건은 붙였는데 해당하는 상품이 0건일 때. */
export const AI_CONSULT_PRODUCT_EMPTY_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]: '{filter} 상품은 지금 준비된 게 없어요.',
  [LanguageCode.ENGLISH]: 'We do not have any {filter} items available now.',
  [LanguageCode.TAIWAN]: '目前沒有 {filter} 的商品。',
};

/** 대분류는 찾았는데 그 아래 상품 분류가 아직 하나도 없을 때. */
export const AI_CONSULT_CATEGORY_EMPTY_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '{name} 카테고리는 아직 준비 중이라 보여드릴 상품이 없어요.',
  [LanguageCode.ENGLISH]:
    'The {name} category is still being prepared, so there is nothing to show yet.',
  [LanguageCode.TAIWAN]: '{name} 類別仍在準備中，目前沒有可顯示的商品。',
};

export const AI_CONSULT_CATEGORY_LIST_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '서울 모먼트는 {count}개 카테고리로 나뉘어 있어요. 궁금한 카테고리를 말씀해 주시면 더 자세히 알려드릴게요.',
  [LanguageCode.ENGLISH]:
    'Seoul Moment is organised into {count} categories. Tell me which one you are interested in and I will show you more.',
  [LanguageCode.TAIWAN]:
    'Seoul Moment 共分為 {count} 個類別。請告訴我您想了解的類別，我會為您進一步說明。',
};

/**
 * 특정 대분류의 소분류 목록 안내.
 * {name} 은 **DB 에서 읽은 이름**으로 치환한다 — 모델이 뱉은 문자열을 쓰면 안 된다.
 */
export const AI_CONSULT_PRODUCT_CATEGORY_LIST_MESSAGE: Record<
  LanguageCode,
  string
> = {
  [LanguageCode.KOREAN]: '{name} 카테고리에는 {count}개 종류가 있어요.',
  [LanguageCode.ENGLISH]: 'There are {count} types under the {name} category.',
  [LanguageCode.TAIWAN]: '{name} 類別中共有 {count} 種商品類型。',
};

export const AI_CONSULT_RATE_LIMITED_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '문의가 잠시 많이 몰렸어요. 잠시 후에 다시 시도해 주시겠어요?',
  [LanguageCode.ENGLISH]:
    'We are handling a lot of requests right now. Could you try again in a moment?',
  [LanguageCode.TAIWAN]: '目前詢問較多，請稍後再試一次好嗎？',
};

/** LLM 장애 또는 일일 예산 초과 */
export const AI_CONSULT_UNAVAILABLE_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '지금은 답변을 준비하기 어려운 상태예요. 잠시 후 다시 시도해 주시거나, 고객센터로 문의해 주시면 빠르게 도와드릴게요.',
  [LanguageCode.ENGLISH]:
    'I am unable to prepare an answer right now. Please try again shortly, or contact our customer service and we will help you right away.',
  [LanguageCode.TAIWAN]:
    '目前無法為您準備回覆。請稍後再試，或聯繫客服，我們將盡快協助您。',
};

/**
 * 대표 질문 3개. 챗 위젯 오픈 시(GET /suggestions)와
 * 매칭 실패·범위 외 응답에 동일하게 쓴다.
 * 운영 2주 뒤 실제 문의 분포로 교체한다.
 */
export const AI_CONSULT_DEFAULT_SUGGESTION_CODES: readonly AiConsultFaqCode[] =
  [
    AiConsultFaqCode.DELIVERY_LEAD_TIME,
    AiConsultFaqCode.REFUND_METHOD,
    AiConsultFaqCode.SIZE_GUIDE,
  ];

const FAQ_BY_CODE: ReadonlyMap<string, AiConsultFaqItem> = new Map(
  AI_CONSULT_FAQ.map((item) => [item.code as string, item]),
);

/** 존재하지 않는 코드면 null. 스키마 enum 을 신뢰하되 SDK 교체/버전업 회귀에 대비한다. */
export function findFaqItem(code: string | null): AiConsultFaqItem | null {
  if (!code || code === FAQ_NONE) return null;

  return FAQ_BY_CODE.get(code) ?? null;
}

export function getAllFaqCodes(): string[] {
  return AI_CONSULT_FAQ.map((item) => item.code as string);
}

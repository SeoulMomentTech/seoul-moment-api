import { LanguageCode } from '@app/repository/enum/language.enum';

/**
 * AI 상담이 사용하는 정적 지식 카탈로그.
 *
 * ⚠️ 아래 answer 문구의 기간·금액·조건 중 미확정 기능은 **초안(placeholder)** 이다.
 *    현재 운영 중인 CS 정책은 Seoul Moment의 대만 판매/한국 조달 구조를 기준으로 작성한다.
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
  ABOUT_SHOP = 'ABOUT_SHOP',
  SUGGESTED_QUESTIONS = 'SUGGESTED_QUESTIONS',
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
        '서울 모먼트의 상품은 상품별 재고 위치와 공급 방식에 따라 배송 기간이 달라질 수 있습니다. 한국에서 준비되는 상품은 결제 확인 후 상품 준비 및 한국 출고, 국제 운송, 대만 통관, 대만 현지 배송 순으로 진행되며 일반적으로 영업일 기준 약 7~20일이 소요될 수 있습니다. 브랜드 출고 일정, 통관, 공휴일 및 물류 상황에 따라 추가 지연이 발생할 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Delivery times at Seoul Moment vary depending on the product’s stock location and supply method. For items prepared in Korea, the process generally includes product preparation, dispatch from Korea, international transportation, customs clearance in Taiwan, and local delivery. Delivery generally takes about 7-20 business days after payment is confirmed, but additional delays may occur due to brand dispatch schedules, customs, holidays, or logistics conditions.',
      [LanguageCode.TAIWAN]:
        'Seoul Moment 的商品會依庫存所在地與供貨方式而有不同的配送時間。由韓國準備的商品，確認付款後將依序進行商品準備、韓國出貨、國際運輸、台灣進口通關及台灣境內配送，一般約需 7～20 個工作日。實際時間可能因品牌出貨進度、通關、假日或物流狀況而有所延遲。',
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
        '마이페이지 > 주문 내역에서 주문 진행 상태를 확인하실 수 있습니다. 배송 단계에 따라 확인 가능한 물류 정보가 다를 수 있으며, 대만 현지 배송이 시작되고 운송장 정보가 등록되면 해당 배송 정보를 통해 조회하실 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'You can check your order progress under My Page > Order History. The logistics information available may vary by shipping stage. Once local delivery in Taiwan begins and a tracking number is registered, you can use that information to track the shipment.',
      [LanguageCode.TAIWAN]:
        '您可以在「我的帳戶 > 訂單記錄」查看訂單目前的處理進度。不同配送階段可查詢的物流資訊可能不同；商品進入台灣境內配送並登錄物流單號後，即可依該物流資訊查詢配送狀態。',
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
        '서울 모먼트는 현재 대만 고객을 대상으로 한국 상품의 구매 및 배송 서비스를 운영하고 있습니다. 한국에서 준비되는 상품은 한국 출고 후 국제 운송과 대만 수입통관을 거쳐 대만 내 지정 배송 방식으로 전달됩니다. 향후 기타 국가 배송이 제공되는 경우 배송 가능 지역과 비용은 결제 화면 또는 별도 안내를 기준으로 합니다.',
      [LanguageCode.ENGLISH]:
        'Seoul Moment currently provides purchasing and delivery services for Korean products primarily to customers in Taiwan. Items prepared in Korea are shipped internationally, cleared through Taiwan customs, and then delivered through the selected local delivery method. If delivery to additional countries becomes available, eligible destinations and fees will be shown at checkout or announced separately.',
      [LanguageCode.TAIWAN]:
        'Seoul Moment 目前主要為台灣顧客提供韓國商品的購買與配送服務。由韓國準備的商品將於韓國出貨後進行國際運輸及台灣進口通關，再依顧客選擇的台灣境內配送方式送達。未來若開放其他國家配送，適用地區與費用將以結帳頁面或另行公告為準。',
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
        '한국에서 대만으로 배송되는 상품은 대만의 수입통관 절차를 거칠 수 있습니다. 통관 과정에서 수취인 본인 확인 또는 EZ WAY(易利委) 실명인증이 요구될 수 있으므로 관련 안내를 받으신 경우 기한 내 완료해 주세요. 관세·수입세 등 추가 비용 발생 여부는 상품 종류, 신고 금액 및 관계 법령에 따라 달라질 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Products shipped from Korea to Taiwan may be subject to Taiwan import customs procedures. Recipient identity verification or EZ WAY real-name authentication may be required, so please complete any requested verification within the stated period. Whether customs duties or import taxes apply depends on the product type, declared value, and applicable regulations.',
      [LanguageCode.TAIWAN]:
        '由韓國寄送至台灣的商品可能需要辦理台灣進口通關。通關過程中可能需要收件人進行身分確認或使用 EZ WAY 易利委完成實名認證；如收到相關通知，請於期限內完成。是否產生關稅、進口稅等額外費用，將依商品種類、申報金額及相關法規而定。',
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
        '브랜드 출고 지연, 한국·대만의 공휴일, 국제 물류, 항공 운송, 기상 상황 또는 대만 통관 절차로 인해 배송이 예상보다 늦어질 수 있습니다. 먼저 마이페이지 > 주문 내역에서 주문 상태를 확인해 주시고, 안내된 예상 기간을 초과한 경우 주문번호와 함께 고객센터로 문의해 주세요.',
      [LanguageCode.ENGLISH]:
        'Delivery may be delayed by brand dispatch schedules, public holidays in Korea or Taiwan, international logistics, air transportation, weather, or Taiwan customs procedures. Please first check your order status under My Page > Order History. If the stated estimated period has passed, contact customer service with your order number.',
      [LanguageCode.TAIWAN]:
        '配送可能因品牌出貨延遲、韓國或台灣國定假日、國際物流、航空運輸、天候或台灣通關程序而超出原預估時間。請先至「我的帳戶 > 訂單記錄」確認訂單狀態；若已超過所公告的預估期間，請提供訂單編號聯繫客服。',
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
        '반품 또는 환불이 필요한 경우 마이페이지 > 주문 내역의 해당 주문에서 신청하거나 고객센터로 문의해 주세요. 신청 내용과 상품 상태를 확인한 후 회수 및 검수가 필요한 경우 절차를 안내해 드립니다. 환불이 승인되면 원칙적으로 기존 결제수단을 기준으로 처리하며, 결제수단에 따라 별도 환불 절차가 안내될 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'If you need a return or refund, submit a request from the relevant order under My Page > Order History or contact customer service. We will review the request and item condition and provide collection or inspection instructions where necessary. Approved refunds are generally processed to the original payment method, although a separate procedure may apply depending on the payment method.',
      [LanguageCode.TAIWAN]:
        '如需辦理退貨或退款，請於「我的帳戶 > 訂單記錄」中的相關訂單提出申請，或聯繫客服。收到申請後，我們會確認申請內容與商品狀況；如需回收或檢驗商品，將另行說明相關流程。退款核准後原則上依原付款方式辦理，但部分付款方式可能需要另行提供退款資料。',
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
        '환불 승인 후 실제 환불 완료 시점은 결제수단과 금융기관의 처리 일정에 따라 달라질 수 있습니다. 서울 모먼트에서 환불 처리를 완료한 이후에도 카드사, 결제대행사 또는 은행의 처리에 추가 시간이 소요될 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'The time required for a refund to appear after approval depends on the payment method and the processing schedule of the relevant financial institution. Even after Seoul Moment completes the refund request, additional processing time may be required by the card issuer, payment provider, or bank.',
      [LanguageCode.TAIWAN]:
        '退款核准後，實際入帳時間會依付款方式及金融機構的處理時間而有所不同。Seoul Moment 完成退款作業後，信用卡公司、支付服務商或銀行仍可能需要額外作業時間。',
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
        '반품은 대만 관련 소비자보호 법령 및 상품별 적용 조건에 따라 처리됩니다. 반품을 원하시는 경우 상품 수령 후 가능한 한 빠르게 신청해 주세요. 상품의 성질, 위생상 이유, 개봉 여부 또는 법령상 합리적인 예외 사유에 따라 해제권 적용이 제한될 수 있으며, 상세 조건은 해당 상품 안내와 반품 절차를 기준으로 합니다.',
      [LanguageCode.ENGLISH]:
        'Returns are handled in accordance with applicable Taiwan consumer protection laws and the conditions applicable to each product. If you wish to return an item, please submit your request as soon as possible after delivery. Depending on the nature of the product, hygiene considerations, whether it has been opened, or other legally permitted exceptions, the right to cancel may be restricted. Please refer to the product notice and return procedure for details.',
      [LanguageCode.TAIWAN]:
        '退貨將依台灣相關消費者保護法規及各商品適用條件辦理。如需退貨，請於收到商品後儘速提出申請。依商品性質、衛生考量、是否已拆封或其他法令所允許的合理例外情形，解除權可能受到限制；詳細條件請以商品頁面說明及退貨流程為準。',
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
        '상품 하자, 오배송 등 서울 모먼트의 책임으로 인정되는 반품의 경우 필요한 반품 배송비는 서울 모먼트가 부담합니다. 그 외 반품에 따른 배송비 부담 여부는 반품 사유, 상품 상태 및 관련 법령에 따라 안내됩니다. 고객센터의 반품 안내를 확인한 후 상품을 발송해 주세요.',
      [LanguageCode.ENGLISH]:
        'If a return is confirmed to be due to Seoul Moment’s responsibility, such as a defective or incorrectly shipped item, Seoul Moment will cover the necessary return shipping cost. For other returns, responsibility for shipping costs will be determined according to the reason for return, item condition, and applicable law. Please follow the return instructions from customer service before sending the item.',
      [LanguageCode.TAIWAN]:
        '若經確認屬商品瑕疵、錯誤出貨等 Seoul Moment 應負責之情形，必要的退貨運費將由 Seoul Moment 負擔。其他退貨情形的運費負擔，將依退貨原因、商品狀況及相關法規判定。寄回商品前請先依客服提供的退貨說明辦理。',
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
        '교환이 필요한 경우 마이페이지 > 주문 내역에서 신청하거나 고객센터로 문의해 주세요. 한국에서 조달되는 상품은 재고와 국제배송 과정으로 인해 직접 교환보다 반품 및 재주문 방식으로 안내될 수 있습니다. 상품 불량 또는 오배송의 경우 확인 후 교환 또는 환불 절차를 안내해 드립니다.',
      [LanguageCode.ENGLISH]:
        'If you need an exchange, submit a request under My Page > Order History or contact customer service. For products sourced from Korea, availability and international shipping may mean that a return and new order is used instead of a direct exchange. For defective or incorrectly shipped items, we will review the issue and provide exchange or refund instructions.',
      [LanguageCode.TAIWAN]:
        '如需換貨，請於「我的帳戶 > 訂單記錄」提出申請，或聯繫客服。由韓國調貨的商品因庫存及國際配送流程，部分情況可能以「退貨後重新下單」取代直接換貨。若屬商品瑕疵或錯誤出貨，確認後將為您說明換貨或退款流程。',
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
        '주문 취소 가능 여부는 현재 주문 처리 단계에 따라 달라집니다. 결제 후 아직 브랜드 발주·상품 확보 또는 출고 절차가 시작되지 않은 주문은 취소가 가능할 수 있으므로 마이페이지에서 확인하거나 고객센터로 문의해 주세요. 이미 상품 확보·출고 또는 국제배송 절차가 진행된 경우 즉시 취소가 제한될 수 있으며, 수령 후 반품 절차가 적용될 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Whether an order can be cancelled depends on its current processing stage. If brand ordering, product procurement, or dispatch preparation has not yet started after payment, cancellation may still be possible; please check My Page or contact customer service. Once procurement, dispatch, or international shipping has begun, immediate cancellation may be restricted and the return procedure may apply after delivery.',
      [LanguageCode.TAIWAN]:
        '訂單是否可取消將依目前處理階段而定。付款後若尚未開始向品牌訂購、備貨或出貨程序，可能仍可取消，請於「我的帳戶」確認或聯繫客服。若商品已進入備貨、出貨或國際配送流程，可能無法立即取消，並可能需於收貨後依退貨流程辦理。',
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
        '배송지 또는 상품 옵션 변경 가능 여부는 주문 처리 단계에 따라 달라집니다. 변경이 필요한 경우 가능한 한 빨리 주문번호와 함께 고객센터로 문의해 주세요. 브랜드 발주, 상품 확보 또는 출고가 이미 진행된 경우 변경이 제한될 수 있으며, 옵션 변경은 기존 주문 취소 후 재주문으로 안내될 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Whether the delivery address or product option can be changed depends on the order processing stage. Please contact customer service with your order number as soon as possible. Changes may be restricted once brand ordering, procurement, or dispatch has begun, and an option change may require cancelling the existing order and placing a new one.',
      [LanguageCode.TAIWAN]:
        '配送地址或商品款式是否可修改，將依訂單目前的處理階段而定。如需修改，請儘快提供訂單編號聯繫客服。若已開始向品牌訂購、備貨或出貨，可能無法修改；款式變更亦可能需要先取消原訂單後重新下單。',
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
        '사용 가능한 결제수단은 서울 모먼트 결제 화면에 표시되는 항목을 기준으로 합니다. 신용카드, 모바일 결제, 계좌이체 등은 실제 활성화된 결제수단에 한해 이용할 수 있으며 결제수단별 승인 조건과 제한은 해당 결제서비스 또는 금융기관 정책에 따를 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Available payment methods are those displayed on the Seoul Moment checkout page. Credit cards, mobile payments, bank transfers, and other methods can be used only when they are currently enabled. Approval requirements and restrictions may vary according to the relevant payment service or financial institution.',
      [LanguageCode.TAIWAN]:
        '實際可使用的付款方式以 Seoul Moment 結帳頁面所顯示的項目為準。信用卡、行動支付、銀行轉帳等方式僅限目前已啟用者使用；各付款方式的授權條件與限制可能依支付服務商或金融機構規定而有所不同。',
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
        '결제가 정상적으로 완료되지 않는 경우 입력한 결제정보, 카드 한도, 금융기관의 거래 제한 또는 해당 결제서비스 상태를 확인해 주세요. 다른 결제수단으로 다시 시도할 수도 있습니다. 동일한 문제가 계속되면 오류 화면 또는 관련 정보를 함께 고객센터로 전달해 주세요.',
      [LanguageCode.ENGLISH]:
        'If payment cannot be completed, please check the payment information entered, card limit, transaction restrictions imposed by your financial institution, and the status of the payment service. You may also try another available payment method. If the issue continues, contact customer service and include the error screen or relevant details.',
      [LanguageCode.TAIWAN]:
        '若付款未能正常完成，請先確認輸入的付款資訊、信用卡額度、金融機構的交易限制，以及該支付服務目前的狀態。您也可以改用其他可用的付款方式再次嘗試。若問題持續發生，請將錯誤畫面或相關資訊提供給客服。',
    },
    title: {
      [LanguageCode.KOREAN]: '결제 실패',
      [LanguageCode.ENGLISH]: 'Payment failed',
      [LanguageCode.TAIWAN]: '付款失敗',
    },
  },
  {
    // TODO(Seoul Moment): 실제 기능/정책 활성화 시 answer 조건 최종 확정
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
        '불편을 드려 죄송합니다. 상품 불량, 파손 또는 오배송이 확인된 경우 상품 수령 후 가능한 한 빠르게 주문번호와 문제를 확인할 수 있는 사진 또는 영상을 준비하여 고객센터로 문의해 주세요. 확인 결과 서울 모먼트의 책임으로 인정되는 경우 필요한 배송비는 서울 모먼트가 부담하고 교환, 재배송 또는 환불 절차를 안내해 드립니다.',
      [LanguageCode.ENGLISH]:
        'We are sorry for the inconvenience. If you receive a defective, damaged, or incorrect item, please contact customer service as soon as possible after delivery with your order number and photos or video showing the issue. If the issue is confirmed to be Seoul Moment’s responsibility, we will cover the necessary shipping costs and provide instructions for an exchange, reshipment, or refund.',
      [LanguageCode.TAIWAN]:
        '造成您的不便，我們深感抱歉。如收到瑕疵、破損或錯誤商品，請於收貨後儘速準備訂單編號及可確認問題的照片或影片並聯繫客服。經確認屬 Seoul Moment 應負責之情形，必要的配送費用將由 Seoul Moment 負擔，並為您說明換貨、重新寄送或退款流程。',
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
    // TODO(Seoul Moment): 실제 기능/정책 활성화 시 answer 조건 최종 확정
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
    // TODO(Seoul Moment): 실제 기능/정책 활성화 시 answer 조건 최종 확정
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
    // TODO(Seoul Moment): 실제 기능/정책 활성화 시 answer 조건 최종 확정
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
        '서울 모먼트 고객센터 운영시간은 평일(월요일~금요일) 10:00~18:00이며, 공휴일은 운영하지 않습니다. 사이트의 문의 채널 또는 서울 모먼트 고객센터를 통해 접수해 주시면 순차적으로 확인해 드립니다. 주문 관련 문의 시 주문번호를 함께 남겨주시면 보다 빠르게 확인할 수 있습니다.',
      [LanguageCode.ENGLISH]:
        'Seoul Moment customer service is available Monday through Friday from 10:00 to 18:00 and is closed on public holidays. Please contact us through the inquiry channel on our website or Seoul Moment customer service. Requests are reviewed in the order received, and including your order number helps us check order-related inquiries more quickly.',
      [LanguageCode.TAIWAN]:
        'Seoul Moment 客服時間為週一至週五 10:00～18:00，國定假日暫停服務。您可透過網站的聯絡管道或 Seoul Moment 客服提出詢問，我們將依序處理。訂單相關問題若能一併提供訂單編號，可協助我們更快確認。',
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
        '주문 관련 영수증 또는 증빙 처리가 필요한 경우 주문번호와 필요한 정보를 준비하여 고객센터로 문의해 주세요. 회사 명의로 영수증 처리가 필요한 경우 회사명과 통일번호(統一編號) 등 필요한 정보를 정확하게 제공해 주세요. 영수증 및 증빙 발행 방식은 서울 모먼트의 실제 처리 절차와 관련 규정에 따라 안내됩니다.',
      [LanguageCode.ENGLISH]:
        'If you need a receipt or supporting document for an order, please contact customer service with your order number and the required information. If the receipt needs to be issued for a company, please provide the correct company name, Unified Business Number (統一編號), and any other required details. Receipt and supporting-document processing will follow Seoul Moment’s actual procedures and applicable regulations.',
      [LanguageCode.TAIWAN]:
        '如需訂單發票、收據或其他相關憑證，請準備訂單編號及所需資料後聯繫客服。如需公司報帳使用，請正確提供公司抬頭、統一編號等開立資訊。實際開立方式與可提供的憑證，將依 Seoul Moment 的實際作業流程及相關規定辦理。',
    },
    title: {
      [LanguageCode.KOREAN]: '영수증 · 증빙 처리',
      [LanguageCode.ENGLISH]: 'Receipts & documents',
      [LanguageCode.TAIWAN]: '發票與收據',
    },
  },
  {
    /**
     * 자사 소개. 이게 없으면 "서울모먼트에 대해 알려줘" 가 범위 외로 나간다 —
     * 자기 쇼핑몰을 묻는 질문을 거절하는 것은 명백한 오류라 별도 항목을 둔다.
     */
    code: AiConsultFaqCode.ABOUT_SHOP,
    intent: '서울 모먼트가 어떤 쇼핑몰인지, 무엇을 파는 곳인지에 대한 소개',
    hints: [
      '서울모먼트가 뭐야',
      '어떤 쇼핑몰이야',
      '여기 뭐 하는 곳',
      '소개해줘',
      'what is seoul moment',
      'about you',
      '這是什麼網站',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '서울 모먼트는 한국의 패션·뷰티·라이프스타일 브랜드와 대만 소비자를 연결하는 큐레이션 커머스 플랫폼입니다. 한국의 다양한 브랜드와 상품을 소개하고, 대만에서 보다 편리하게 상품을 확인하고 구매할 수 있도록 서비스를 제공합니다. 입점 브랜드나 상품 카테고리가 궁금하시면 "브랜드 목록" 또는 "카테고리 알려줘"라고 말씀해 주세요.',
      [LanguageCode.ENGLISH]:
        'Seoul Moment is a curated commerce platform connecting Korean fashion, beauty, and lifestyle brands with consumers in Taiwan. We introduce a variety of Korean brands and products and provide services that make them easier to discover and purchase in Taiwan. Ask for the "brand list" or "categories" to explore what we carry.',
      [LanguageCode.TAIWAN]:
        'Seoul Moment 是連結韓國時尚、美妝與生活風格品牌和台灣消費者的選品電商平台。我們介紹來自韓國的多元品牌與商品，並提供讓台灣消費者更方便認識及購買韓國商品的服務。想了解進駐品牌或商品類別，可以直接詢問「品牌列表」或「有哪些類別」。',
    },
    title: {
      [LanguageCode.KOREAN]: '서울 모먼트 소개',
      [LanguageCode.ENGLISH]: 'About Seoul Moment',
      [LanguageCode.TAIWAN]: '關於 Seoul Moment',
    },
  },
  {
    /** "다른 질문 추천해줘" 류. 답변보다 함께 붙는 추천 칩이 본체다. */
    code: AiConsultFaqCode.SUGGESTED_QUESTIONS,
    intent: '무엇을 물어볼 수 있는지, 다른 질문을 추천해 달라는 요청',
    hints: [
      '뭘 물어볼 수 있어',
      '다른 질문 추천',
      '질문 예시',
      '도움말',
      'what can you do',
      'help',
      '可以問什麼',
    ],
    answer: {
      [LanguageCode.KOREAN]:
        '주문·배송·교환·환불·사이즈 같은 이용 안내를 도와드리고, 입점 브랜드나 카테고리 목록, 색상별 상품 찾기도 가능해요. 아래에서 골라 보세요.',
      [LanguageCode.ENGLISH]:
        'I can help with orders, delivery, exchanges, refunds and sizing, and I can also show you our brands, categories, and products by colour. Pick one below.',
      [LanguageCode.TAIWAN]:
        '我可以協助訂單、配送、換貨、退款與尺寸等問題，也能為您顯示品牌、類別列表或依顏色尋找商品。請從下方選擇。',
    },
    title: {
      [LanguageCode.KOREAN]: '무엇을 물어볼까요?',
      [LanguageCode.ENGLISH]: 'What can I ask?',
      [LanguageCode.TAIWAN]: '可以問什麼？',
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

/**
 * 인사·응원·감탄 등 답할 내용은 없지만 이해는 한 말.
 *
 * FALLBACK("이해하지 못했어요")과 반드시 구분한다. "서울모먼트 화이팅"에 이해 실패로
 * 답하면 고객은 자기 표현이 잘못된 줄 알고 같은 말을 바꿔가며 반복하게 된다.
 * 짧게 받아주고 추천 칩으로 다음 행동을 제시한다.
 */
export const AI_CONSULT_SMALL_TALK_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '감사합니다! 쇼핑에 도움이 필요하시면 언제든 말씀해 주세요. 아래 주제로 시작하셔도 좋아요.',
  [LanguageCode.ENGLISH]:
    'Thank you! Let me know whenever you need help with your shopping. Feel free to start with one of the topics below.',
  [LanguageCode.TAIWAN]:
    '謝謝您！購物上有任何需要都歡迎告訴我。也可以從下方主題開始。',
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

/**
 * 넓은 말("모자")에 분류가 여럿 걸렸을 때 조건 이름을 줄이는 표기.
 *
 * 다 나열하면 "러닝 모자, 비니 모자, 버킷 모자, … 상품 12개를 찾았어요"처럼
 * 문장이 조건에 잡아먹힌다. 앞의 몇 개만 보이고 나머지는 개수로 줄인다.
 */
export const AI_CONSULT_FILTER_NAME_OVERFLOW: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]: '{names} 외 {rest}개',
  [LanguageCode.ENGLISH]: '{names} and {rest} more',
  [LanguageCode.TAIWAN]: '{names} 等 {rest} 項',
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

/**
 * 취급 색상 목록. {count} 는 DB 에서 읽은 실제 건수로 치환된다.
 * 색상 이름은 이 문구가 아니라 응답의 colors 배열로 나간다.
 */
export const AI_CONSULT_COLOR_LIST_MESSAGE: Record<LanguageCode, string> = {
  [LanguageCode.KOREAN]:
    '현재 {count}가지 색상의 상품이 있어요. 원하는 색을 말씀해 주시면 해당 상품을 찾아드릴게요.',
  [LanguageCode.ENGLISH]:
    'We currently carry items in {count} colours. Tell me which colour you want and I will find matching products.',
  [LanguageCode.TAIWAN]:
    '目前共有 {count} 種顏色的商品。告訴我您想要的顏色，我將為您尋找相關商品。',
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

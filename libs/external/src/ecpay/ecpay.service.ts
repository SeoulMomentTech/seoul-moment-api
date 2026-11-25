import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

import { generateCheckMacValue, verifyCheckMacValue } from './ecpay.check-mac';
import { formatTaipeiDateTime, isEcpayClosingWindow } from './ecpay.date';
import {
  EcpayCheckoutForm,
  EcpayCheckoutInput,
  EcpayCreditAction,
  EcpayCreditActionResultDto,
  EcpayCreditTradeDto,
  EcpayTradeInfoDto,
} from './ecpay.dto';

/** ECPay 문서 기준 길이 제한. 넘기면 ECPay 가 잘라서 CheckMacValue 가 틀어진다 */
const ITEM_NAME_MAX = 400;
const TRADE_DESC_MAX = 200;

interface EcpayCredentials {
  merchantId: string;
  hashKey: string;
  hashIV: string;
  paymentUrl: string;
}

/**
 * ECPay 통합결제(全方位金流, AIO) 클라이언트.
 *
 * 결제창 진입은 서버→서버 호출이 아니라 브라우저 form POST 다. 그래서 여기서는
 * form 필드와 CheckMacValue 만 만들고, 실제 전송은 handoff 페이지가 한다.
 * 결제 결과는 ECPay 가 ReturnURL 로 보내 주며 verifyCallback 으로 검증한다.
 */
@Injectable()
export class ExternalEcpayService {
  private readonly logger = new Logger(ExternalEcpayService.name);

  constructor(private readonly httpService: HttpService) {}

  buildCheckoutForm(input: EcpayCheckoutInput): EcpayCheckoutForm {
    const { merchantId, hashKey, hashIV, paymentUrl } = this.getCredentials();

    const fields: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: input.merchantTradeNo,
      MerchantTradeDate: formatTaipeiDateTime(input.tradeDate),
      PaymentType: 'aio',
      TotalAmount: String(input.totalAmount),
      TradeDesc: truncate(input.tradeDesc, TRADE_DESC_MAX),
      ItemName: buildItemName(input.itemNames),
      ReturnURL: input.returnUrl,
      ChoosePayment: 'ALL',
      EncryptType: '1',
      // 카드 승인번호(gwsr)를 결제 통지로 받는다 — 카드 환불 전 거래 조회에 쓴다
      NeedExtraPaidInfo: 'Y',
      OrderResultURL: input.orderResultUrl,
      ClientRedirectURL: input.clientRedirectUrl,
      PaymentInfoURL: input.paymentInfoUrl,
      ExpireDate: String(input.atmExpireDays),
      StoreExpireDate: String(input.cvsExpireMinutes),
    };

    if (input.clientBackUrl) {
      fields.ClientBackURL = input.clientBackUrl;
    }

    if (input.language) {
      fields.Language = input.language;
    }

    if (input.ignorePayments.length > 0) {
      fields.IgnorePayment = input.ignorePayments.join('#');
    }

    fields.CheckMacValue = generateCheckMacValue(fields, hashKey, hashIV);

    return { action: `${paymentUrl}/Cashier/AioCheckOut/V5`, fields };
  }

  /** ReturnURL · PaymentInfoURL · OrderResultURL 로 받은 필드 전부를 그대로 넣는다 */
  verifyCallback(params: Record<string, string>): boolean {
    const { hashKey, hashIV } = this.getCredentials();

    return verifyCheckMacValue(params, hashKey, hashIV);
  }

  /**
   * 주문 조회. ReturnURL 을 놓친 카드 결제를 메울 때만 쓴다.
   * ATM·편의점 같은 오프라인 결제는 조회하지 말고 통지를 기다리라는 게 ECPay 입장이다.
   * 너무 자주 부르면 403 과 함께 30분 차단되므로 배치 주기를 넉넉히 둔다.
   */
  async queryTradeInfo(merchantTradeNo: string): Promise<EcpayTradeInfoDto> {
    const { merchantId, hashKey, hashIV } = this.getCredentials();

    const params: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: merchantTradeNo,
      TimeStamp: String(Math.floor(Date.now() / 1000)),
    };
    const data = await this.postForm('/Cashier/QueryTradeInfo/V5', params);
    const parsed = Object.fromEntries(new URLSearchParams(data));
    const verified = verifyCheckMacValue(parsed, hashKey, hashIV);

    // 검증이 안 된 응답으로는 결제 완료도, 만료도 정하지 않는다 — 호출한 쪽이 "모름"으로 다룬다
    if (!verified) {
      this.logger.warn(
        `QueryTradeInfo CheckMacValue mismatch: ${merchantTradeNo}`,
      );
    }

    return EcpayTradeInfoDto.from(parsed, verified);
  }

  /** 상점 검사 코드가 있어야 카드 거래를 조회할 수 있고, 조회 없이는 환불을 보내지 않는다 */
  isCreditRefundEnabled(): boolean {
    return !!Configuration.getConfig().ECPAY_CREDIT_CHECK_CODE;
  }

  /** 지금이 ECPay 의 매일 매입 시간대인지 — 이때는 doCreditAction 을 부르지 않는다 */
  isCreditClosingWindow(): boolean {
    return isEcpayClosingWindow(new Date());
  }

  /**
   * 카드 거래 한 건의 매입·환불 상태 (developers.ecpay.com.tw/2894).
   * creditRefundId 는 결제 통지의 gwsr. 너무 자주 부르면 403 과 함께 30분 차단된다.
   */
  async queryCreditTrade(
    creditRefundId: string,
    amount: number,
  ): Promise<EcpayCreditTradeDto> {
    const data = await this.postForm('/CreditDetail/QueryTrade/V2', {
      MerchantID: this.getCredentials().merchantId,
      CreditRefundId: creditRefundId,
      CreditAmount: String(amount),
      CreditCheckCode: Configuration.getConfig().ECPAY_CREDIT_CHECK_CODE,
    });

    return EcpayCreditTradeDto.fromJson(data);
  }

  /**
   * 카드 請退款 (developers.ecpay.com.tw/2885). 멱등이 아니다 — 같은 R 을 두 번 보내면
   * 두 번 환불된다(2026-11-25 stage 실측). 결과를 모르면 queryCreditTrade 로 확인한다.
   * 매일 20:15~20:30(대만)에는 부르지 않는다.
   */
  async doCreditAction(
    merchantTradeNo: string,
    tradeNo: string,
    action: EcpayCreditAction,
    amount: number,
  ): Promise<EcpayCreditActionResultDto> {
    const data = await this.postForm(
      '/CreditDetail/DoAction',
      {
        MerchantID: this.getCredentials().merchantId,
        MerchantTradeNo: merchantTradeNo,
        TradeNo: tradeNo,
        Action: action,
        TotalAmount: String(amount),
      },
      20_000,
    );

    return EcpayCreditActionResultDto.from(
      Object.fromEntries(new URLSearchParams(data)),
    );
  }

  /** CheckMacValue 를 붙여 form 으로 보내고 응답 원문을 돌려준다 */
  private async postForm(
    path: string,
    params: Record<string, string>,
    timeout = 10_000,
  ): Promise<string> {
    const { hashKey, hashIV, paymentUrl } = this.getCredentials();
    const body = {
      ...params,
      CheckMacValue: generateCheckMacValue(params, hashKey, hashIV),
    };
    const { data } = await lastValueFrom(
      this.httpService.post<string>(
        `${paymentUrl}${path}`,
        new URLSearchParams(body).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          responseType: 'text',
          transformResponse: [(raw: string) => raw],
          timeout,
        },
      ),
    );

    return String(data);
  }

  private getCredentials(): EcpayCredentials {
    const config = Configuration.getConfig();

    if (
      !config.ECPAY_MERCHANT_ID ||
      !config.ECPAY_HASH_KEY ||
      !config.ECPAY_HASH_IV
    ) {
      throw new ServiceError(
        'ECPay 설정(ECPAY_MERCHANT_ID / HASH_KEY / HASH_IV)이 비어 있습니다.',
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      merchantId: config.ECPAY_MERCHANT_ID,
      hashKey: config.ECPAY_HASH_KEY,
      hashIV: config.ECPAY_HASH_IV,
      paymentUrl: config.ECPAY_PAYMENT_URL,
    };
  }
}

/** 상품명은 # 로 잇는다. 상품명 안의 # 는 구분자로 읽히므로 공백으로 바꾼다 */
export function buildItemName(names: string[]): string {
  const joined = names
    .map((name) => name.replace(/#/g, ' ').trim())
    .filter((name) => name.length > 0)
    .join('#');

  return truncate(joined || 'Seoul Moment', ITEM_NAME_MAX);
}

/** 서로게이트 쌍(이모지)을 반으로 자르지 않도록 코드 포인트 단위로 자른다 */
function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }

  return `${truncateUtf16(value, max - 3)}...`;
}

/**
 * ECPay(.NET)는 길이를 UTF-16 코드 단위로 센다 — 이모지는 2자다. 그 기준으로 자르되
 * 서로게이트 쌍을 반으로 쪼개지 않는다.
 */
export function truncateUtf16(value: string, max: number): string {
  let result = '';

  for (const char of value) {
    if (result.length + char.length > max) {
      break;
    }

    result += char;
  }

  return result;
}

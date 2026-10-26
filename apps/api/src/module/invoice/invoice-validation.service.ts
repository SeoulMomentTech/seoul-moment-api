import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { EcpayInvoiceCheckDto } from '@app/external/ecpay/ecpay-invoice.dto';
import { ExternalEcpayInvoiceService } from '@app/external/ecpay/ecpay-invoice.service';
import { InvoiceType } from '@app/repository/enum/invoice.enum';
import { Injectable, Logger } from '@nestjs/common';

import {
  GetInvoiceCheckResponse,
  UserOrderInvoiceRequest,
} from './invoice.dto';
import {
  CITIZEN_CERT_PATTERN,
  isValidTaxId,
  LOVE_CODE_PATTERN,
  MOBILE_BARCODE_PATTERN,
} from './invoice.util';

/** 확인 결과를 하루 담아 둔다. 같은 값을 키 입력마다 ECPay 에 묻지 않게 한다 */
const CHECK_CACHE_SECONDS = 24 * 60 * 60;
const CACHE_PREFIX = 'invoice_check';

/**
 * 전자발표 입력값 확인.
 *
 * - 愛心碼: Issue 는 존재 여부를 검사하지 않는다 — 없는 코드로도 발행돼 버리므로 반드시 묻는다
 * - 휴대폰 바코드: 재정부 장애(9000001)·네트워크 오류면 형식만 맞을 때 받아들인다 (ECPay FAQ 권장)
 * - 統編: 검사코드만 본다. 회사명 조회는 화면 편의용이다
 * HashKey 를 프론트에 둘 수 없어서 확인 API 도 서버를 거친다.
 */
@Injectable()
export class InvoiceValidationService {
  private readonly logger = new Logger(InvoiceValidationService.name);

  constructor(
    private readonly ecpayInvoiceService: ExternalEcpayInvoiceService,
    private readonly cacheService: CacheService,
  ) {}

  async checkMobileBarcode(raw: string): Promise<GetInvoiceCheckResponse> {
    const code = (raw ?? '').trim().toUpperCase();

    if (!MOBILE_BARCODE_PATTERN.test(code)) {
      return GetInvoiceCheckResponse.of(false, true);
    }

    return this.cached(`barcode:${code}`, () =>
      this.ecpayInvoiceService.checkBarcode(code),
    );
  }

  async checkLoveCode(raw: string): Promise<GetInvoiceCheckResponse> {
    const code = (raw ?? '').trim();

    if (!LOVE_CODE_PATTERN.test(code)) {
      return GetInvoiceCheckResponse.of(false, true);
    }

    return this.cached(`love:${code}`, () =>
      this.ecpayInvoiceService.checkLoveCode(code),
    );
  }

  async checkCompany(raw: string): Promise<GetInvoiceCheckResponse> {
    const taxId = (raw ?? '').trim();

    if (!isValidTaxId(taxId)) {
      return GetInvoiceCheckResponse.of(false, true);
    }

    const result = await this.cached(`company:${taxId}`, () =>
      this.ecpayInvoiceService.getCompanyName(taxId),
    );

    // 공개 데이터에 없는 회사도 발행은 된다. 검사코드가 맞으면 쓸 수 있는 값이다
    return GetInvoiceCheckResponse.of(true, result.verified, result.name);
  }

  /**
   * 주문 생성 직전. 형식이 틀리면 400, ECPay 가 "없다"고 확인해 준 값도 400.
   * 확인을 못 한 경우(장애)는 막지 않는다 — 결제를 막는 것보다 낫다.
   */
  async assertValid(invoice: UserOrderInvoiceRequest): Promise<void> {
    this.assertFormat(invoice);

    if (invoice.type === InvoiceType.DONATION) {
      const result = await this.checkLoveCode(invoice.loveCode ?? '');
      this.assertConfirmed(result, 'loveCode');
    }

    if (invoice.type === InvoiceType.MOBILE_BARCODE) {
      const result = await this.checkMobileBarcode(invoice.carrierNum ?? '');
      this.assertConfirmed(result, 'carrierNum');
    }
  }

  private assertFormat(invoice: UserOrderInvoiceRequest) {
    const invalid = (field: string) => {
      throw new ServiceError(
        `Invalid invoice ${field} for ${invoice.type}`,
        ServiceErrorCode.BAD_REQUEST,
        { field },
      );
    };

    if (
      invoice.type === InvoiceType.MOBILE_BARCODE &&
      !MOBILE_BARCODE_PATTERN.test(invoice.carrierNum ?? '')
    ) {
      invalid('carrierNum');
    }

    if (
      invoice.type === InvoiceType.CITIZEN_CERT &&
      !CITIZEN_CERT_PATTERN.test(invoice.carrierNum ?? '')
    ) {
      invalid('carrierNum');
    }

    if (
      invoice.type === InvoiceType.COMPANY &&
      !isValidTaxId(invoice.companyTaxId ?? '')
    ) {
      invalid('companyTaxId');
    }
  }

  private assertConfirmed(result: GetInvoiceCheckResponse, field: string) {
    if (!result.valid) {
      throw new ServiceError(
        `Invoice ${field} does not exist`,
        ServiceErrorCode.BAD_REQUEST,
        { field },
      );
    }
  }

  /** 확정 답(있다/없다)만 담아 둔다. 장애·오류는 담지 않고 형식만 맞으면 통과시킨다 */
  private async cached(
    key: string,
    ask: () => Promise<EcpayInvoiceCheckDto>,
  ): Promise<GetInvoiceCheckResponse> {
    const cacheKey = `${CACHE_PREFIX}:${key}`;
    const hit = await this.cacheService.find(cacheKey).catch(() => null);

    if (hit) {
      const saved = JSON.parse(hit) as { valid: boolean; name: string | null };

      return GetInvoiceCheckResponse.of(saved.valid, true, saved.name);
    }

    try {
      const result = await ask();

      if (result.isUnavailable()) {
        return GetInvoiceCheckResponse.of(true, false);
      }

      await this.cacheService
        .set(
          cacheKey,
          JSON.stringify({ valid: result.exists, name: result.name }),
          CHECK_CACHE_SECONDS,
        )
        .catch(() => undefined);

      return GetInvoiceCheckResponse.of(result.exists, true, result.name);
    } catch (error) {
      this.logger.warn(`invoice check unavailable: ${key} ${error}`);

      return GetInvoiceCheckResponse.of(true, false);
    }
  }
}

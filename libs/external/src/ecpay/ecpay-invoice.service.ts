import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

import {
  EcpayInvoiceCheckDto,
  EcpayInvoiceIssueData,
  EcpayInvoiceResultDto,
} from './ecpay-invoice.dto';
import { decryptEcpayData, encryptEcpayData } from './ecpay.aes';

interface EcpayInvoiceEnvelope {
  TransCode: number;
  TransMsg: string;
  Data?: string;
}

/**
 * ECPay B2C 전자발표 클라이언트 (developers.ecpay.com.tw/7896 등).
 *
 * 요청·응답 모두 { MerchantID, RqHeader/RpHeader, Data } 봉투이고 Data 는 AES 로 암호화한다.
 * TransCode=1 은 봉투를 받았다는 뜻일 뿐이고 실제 결과는 Data 안의 RtnCode 다.
 * 네트워크 오류·봉투 오류는 ServiceError 로 던진다 — 결과를 모르는 것이므로 호출한 쪽이
 * 같은 RelateNumber 로 조회(getIssue)부터 해야 한다.
 */
@Injectable()
export class ExternalEcpayInvoiceService {
  private readonly logger = new Logger(ExternalEcpayInvoiceService.name);

  constructor(private readonly httpService: HttpService) {}

  async issue(data: EcpayInvoiceIssueData): Promise<EcpayInvoiceResultDto> {
    const result = await this.post('/B2CInvoice/Issue', data);

    return EcpayInvoiceResultDto.fromIssue(result);
  }

  async getIssue(relateNumber: string): Promise<EcpayInvoiceResultDto> {
    const result = await this.post('/B2CInvoice/GetIssue', {
      RelateNumber: relateNumber,
    });

    return EcpayInvoiceResultDto.fromGetIssue(result);
  }

  async checkBarcode(barcode: string): Promise<EcpayInvoiceCheckDto> {
    const result = await this.post('/B2CInvoice/CheckBarcode', {
      BarCode: barcode,
    });

    return EcpayInvoiceCheckDto.from(result);
  }

  async checkLoveCode(loveCode: string): Promise<EcpayInvoiceCheckDto> {
    const result = await this.post('/B2CInvoice/CheckLoveCode', {
      LoveCode: loveCode,
    });

    return EcpayInvoiceCheckDto.from(result);
  }

  /** RtnCode 1 이면 회사명이 있다. 7(공개 데이터에 없음)이어도 발행은 가능하다 */
  async getCompanyName(taxId: string): Promise<EcpayInvoiceCheckDto> {
    const result = await this.post('/B2CInvoice/GetCompanyNameByTaxID', {
      UnifiedBusinessNo: taxId,
    });
    const dto = EcpayInvoiceCheckDto.from(result);
    dto.exists = dto.rtnCode === 1;

    return dto;
  }

  private async post(
    path: string,
    data: object,
  ): Promise<Record<string, unknown>> {
    const { merchantId, hashKey, hashIV, url } = this.getCredentials();

    const body = {
      MerchantID: merchantId,
      RqHeader: { Timestamp: Math.floor(Date.now() / 1000) },
      Data: encryptEcpayData(
        { MerchantID: merchantId, ...data },
        hashKey,
        hashIV,
      ),
    };

    try {
      const { data: envelope } = await lastValueFrom(
        this.httpService.post<EcpayInvoiceEnvelope>(`${url}${path}`, body, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15_000,
        }),
      );

      if (envelope.TransCode !== 1 || !envelope.Data) {
        throw new Error(`TransCode=${envelope.TransCode} ${envelope.TransMsg}`);
      }

      return decryptEcpayData<Record<string, unknown>>(
        envelope.Data,
        hashKey,
        hashIV,
      );
    } catch (error) {
      this.logger.error(`ECPay invoice ${path} failed: ${error}`);

      throw new ServiceError(
        `ECPay 전자발표 호출 실패: ${path}`,
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getCredentials() {
    const config = Configuration.getConfig();

    if (
      !config.ECPAY_INVOICE_MERCHANT_ID ||
      !config.ECPAY_INVOICE_HASH_KEY ||
      !config.ECPAY_INVOICE_HASH_IV
    ) {
      throw new ServiceError(
        'ECPay 전자발표 설정(ECPAY_INVOICE_*)이 비어 있습니다.',
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      merchantId: config.ECPAY_INVOICE_MERCHANT_ID,
      hashKey: config.ECPAY_INVOICE_HASH_KEY,
      hashIV: config.ECPAY_INVOICE_HASH_IV,
      url: config.ECPAY_INVOICE_URL,
    };
  }
}

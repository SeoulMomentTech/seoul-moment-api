/** 전자발표 Issue 의 Items 한 줄 (B2C, vat=1 세금 포함 가격) */
export interface EcpayInvoiceItem {
  ItemSeq: number;
  ItemName: string;
  ItemCount: number;
  ItemWord: string;
  ItemPrice: number;
  ItemAmount: number;
}

/** B2CInvoice/Issue 의 Data. 필드 조합 규칙은 invoice.util 의 buildIssueData 가 지킨다 */
export interface EcpayInvoiceIssueData {
  RelateNumber: string;
  CustomerID: string;
  CustomerIdentifier: string;
  CustomerName: string;
  CustomerAddr: string;
  CustomerPhone: string;
  CustomerEmail: string;
  ClearanceMark: string;
  Print: '0' | '1';
  Donation: '0' | '1';
  LoveCode: string;
  CarrierType: '' | '1' | '2' | '3';
  CarrierNum: string;
  TaxType: '1';
  SalesAmount: number;
  InvoiceRemark: string;
  InvType: '07';
  vat: '1';
  Items: EcpayInvoiceItem[];
}

export const EcpayInvoiceRtnCode = {
  SUCCESS: 1,
  /** GetIssue: 발표 없음 */
  NOT_FOUND: 2,
  /** 같은 RelateNumber 로 이미 발행됨 */
  DUPLICATE_RELATE_NUMBER: 5070357,
  /** 재정부 API 장애 (검증 API) */
  MOF_UNAVAILABLE: 9000001,
} as const;

export class EcpayInvoiceResultDto {
  rtnCode: number;
  rtnMsg: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  randomNumber: string | null;

  static fromIssue(data: Record<string, unknown>): EcpayInvoiceResultDto {
    const dto = new EcpayInvoiceResultDto();
    dto.rtnCode = Number(data.RtnCode);
    dto.rtnMsg = String(data.RtnMsg ?? '');
    dto.invoiceNo = (data.InvoiceNo as string) || null;
    dto.invoiceDate = (data.InvoiceDate as string) || null;
    dto.randomNumber = (data.RandomNumber as string) || null;

    return dto;
  }

  /** GetIssue 응답은 필드 이름이 IIS_ 로 시작한다 */
  static fromGetIssue(data: Record<string, unknown>): EcpayInvoiceResultDto {
    const dto = new EcpayInvoiceResultDto();
    dto.rtnCode = Number(data.RtnCode);
    dto.rtnMsg = String(data.RtnMsg ?? '');
    dto.invoiceNo = (data.IIS_Number as string) || null;
    dto.invoiceDate = (data.IIS_Create_Date as string) || null;
    dto.randomNumber = (data.IIS_Random_Number as string) || null;

    return dto;
  }

  isIssued(): boolean {
    return this.rtnCode === EcpayInvoiceRtnCode.SUCCESS && !!this.invoiceNo;
  }
}

/** 검증 API (CheckBarcode · CheckLoveCode · GetCompanyNameByTaxID) 결과 */
export class EcpayInvoiceCheckDto {
  rtnCode: number;
  exists: boolean;
  name: string | null;

  static from(data: Record<string, unknown>): EcpayInvoiceCheckDto {
    const dto = new EcpayInvoiceCheckDto();
    dto.rtnCode = Number(data.RtnCode);
    dto.exists = data.IsExist === 'Y';
    dto.name = ((data.OrganName ?? data.CompanyName) as string) || null;

    return dto;
  }

  /** 재정부 장애 등으로 확인 자체를 못 했다 */
  isUnavailable(): boolean {
    return this.rtnCode === EcpayInvoiceRtnCode.MOF_UNAVAILABLE;
  }
}

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
  /** Invalid: 이미 作廢 된 발표 */
  ALREADY_VOIDED: 5070453,
  /** Allowance: 折讓 할 수 있는 금액이 0 (이미 전액 折讓) */
  NOTHING_TO_ALLOW: 2000035,
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
  /** GetIssue 에서만 채운다. 作廢 됐는지 */
  isVoided = false;
  /** GetIssue 에서만 채운다. 앞으로 折讓 할 수 있는 금액 */
  remainAllowanceAmount: number | null = null;

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
    dto.isVoided = String(data.IIS_Invalid_Status) === '1';
    // 값이 없거나 빈 문자열이면 '모름'이다 — 0 으로 읽으면 이미 折讓 된 것으로 닫힌다
    const remain = data.IIS_Remain_Allowance_Amt;
    dto.remainAllowanceAmount =
      remain === undefined || remain === null || remain === ''
        ? null
        : Number(remain);

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

/** B2CInvoice/Allowance 의 Data (일반 開立折讓). ItemAmount 합 = AllowanceAmount, 세금 포함 */
export interface EcpayInvoiceAllowanceData {
  InvoiceNo: string;
  InvoiceDate: string;
  AllowanceNotify: 'E' | 'N';
  NotifyMail: string;
  AllowanceAmount: number;
  Reason: string;
  Items: (EcpayInvoiceItem & { ItemTaxType: '1' })[];
}

/** 作廢(Invalid) · 折讓(Allowance) 결과 */
export class EcpayInvoiceAdjustResultDto {
  rtnCode: number;
  rtnMsg: string;
  allowanceNo: string | null;

  static from(data: Record<string, unknown>): EcpayInvoiceAdjustResultDto {
    const dto = new EcpayInvoiceAdjustResultDto();
    dto.rtnCode = Number(data.RtnCode);
    dto.rtnMsg = String(data.RtnMsg ?? '');
    dto.allowanceNo = (data.IA_Allow_No as string) || null;

    return dto;
  }

  /** 이미 처리된 건에 다시 요청한 경우도 끝난 것으로 본다 */
  isDone(): boolean {
    return (
      this.rtnCode === EcpayInvoiceRtnCode.SUCCESS ||
      this.rtnCode === EcpayInvoiceRtnCode.ALREADY_VOIDED ||
      this.rtnCode === EcpayInvoiceRtnCode.NOTHING_TO_ALLOW
    );
  }
}

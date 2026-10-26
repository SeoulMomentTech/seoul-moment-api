import { OrderInvoiceEntity } from '@app/repository/entity/order-invoice.entity';
import { InvoiceStatus, InvoiceType } from '@app/repository/enum/invoice.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { LOVE_CODE_PATTERN } from './invoice.util';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** 주문서의 전자발표 선택. 생략하면 ECPay 회원 載具(MEMBER_CARRIER) */
export class UserOrderInvoiceRequest {
  @ApiProperty({
    description:
      '발표 받는 방법. MEMBER_CARRIER ECPay 회원 載具(이메일로 받음) / MOBILE_BARCODE 휴대폰 바코드 / CITIZEN_CERT 自然人憑證 / DONATION 기부 / COMPANY 회사(統一編號)',
    enum: InvoiceType,
    example: InvoiceType.MOBILE_BARCODE,
  })
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @ApiPropertyOptional({
    description:
      'MOBILE_BARCODE: "/" + 7자 (영문 대문자·숫자·+-.) / CITIZEN_CERT: 영문 대문자 2 + 숫자 14. 소문자로 보내도 대문자로 바꾼다',
    example: '/ABC1234',
  })
  // 타입마다 형식이 달라서 형식은 InvoiceValidationService.assertFormat 이 본다
  @ValidateIf(
    (o: UserOrderInvoiceRequest) =>
      o.type === InvoiceType.MOBILE_BARCODE ||
      o.type === InvoiceType.CITIZEN_CERT,
  )
  @Transform(upper)
  @IsString()
  @MaxLength(16)
  carrierNum?: string;

  @ApiPropertyOptional({
    description: 'DONATION: 愛心碼 숫자 3–7자리',
    example: '168001',
  })
  @ValidateIf((o: UserOrderInvoiceRequest) => o.type === InvoiceType.DONATION)
  @Transform(trim)
  @IsString()
  @Matches(LOVE_CODE_PATTERN)
  loveCode?: string;

  @ApiPropertyOptional({
    description: 'COMPANY: 統一編號 8자리 (검사코드 확인)',
    example: '97025978',
  })
  @ValidateIf((o: UserOrderInvoiceRequest) => o.type === InvoiceType.COMPANY)
  @Transform(trim)
  @IsString()
  @Matches(/^\d{8}$/)
  companyTaxId?: string;

  @ApiPropertyOptional({
    description: 'COMPANY: 회사명 (60자 이하)',
    example: '首爾映像有限公司',
  })
  @ValidateIf((o: UserOrderInvoiceRequest) => o.type === InvoiceType.COMPANY)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  companyName?: string;
}

export class GetOrderInvoiceResponse {
  @ApiProperty({ enum: InvoiceType, example: InvoiceType.MOBILE_BARCODE })
  type: InvoiceType;

  @ApiProperty({
    description:
      '발행 상태. PENDING 결제 전·발행 대기 / ISSUED 발행됨 / FAILED 발행 실패(서버가 다시 시도한다)',
    enum: InvoiceStatus,
    example: InvoiceStatus.ISSUED,
  })
  status: InvoiceStatus;

  @ApiPropertyOptional({
    description: '휴대폰 바코드 · 自然人憑證',
    nullable: true,
  })
  carrierNum: string | null;

  @ApiPropertyOptional({ description: '愛心碼', nullable: true })
  loveCode: string | null;

  @ApiPropertyOptional({ description: '統一編號', nullable: true })
  companyTaxId: string | null;

  @ApiPropertyOptional({ description: '회사명', nullable: true })
  companyName: string | null;

  @ApiPropertyOptional({
    description: '발표번호',
    example: 'LY74004967',
    nullable: true,
  })
  invoiceNo: string | null;

  @ApiPropertyOptional({ description: '발행 시각', nullable: true })
  invoiceDate: Date | null;

  @ApiPropertyOptional({
    description: '랜덤 번호 4자리',
    example: '3204',
    nullable: true,
  })
  randomNumber: string | null;

  static from(entity: OrderInvoiceEntity): GetOrderInvoiceResponse {
    return plainToInstance(this, {
      type: entity.type,
      status: entity.status,
      carrierNum: entity.carrierNum,
      loveCode: entity.loveCode,
      companyTaxId: entity.companyTaxId,
      companyName: entity.companyName,
      invoiceNo: entity.invoiceNo,
      invoiceDate: entity.invoiceDate,
      randomNumber: entity.randomNumber,
    });
  }
}

export class GetInvoiceCheckResponse {
  @ApiProperty({
    description:
      '쓸 수 있는 값인지. 재정부 장애로 확인을 못 했으면 형식만 맞을 때 true 이고 verified 가 false 다',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'ECPay(재정부)에 실제로 물어봐서 확인했는지',
    example: true,
  })
  verified: boolean;

  @ApiPropertyOptional({
    description: '기부처 이름(愛心碼) 또는 회사명(統編)',
    example: '財團法人台灣兒童暨家庭扶助基金會',
    nullable: true,
  })
  name: string | null;

  static of(valid: boolean, verified: boolean, name: string | null = null) {
    return plainToInstance(this, { valid, verified, name });
  }
}

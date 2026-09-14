import { HttpStatus } from '@nestjs/common';

import { ServiceErrorCode, ServiceErrorStatus } from './dto/exception.dto';

export class ServiceError extends Error {
  private readonly code: ServiceErrorCode;

  /**
   * 화면이 어느 항목 때문에 실패했는지 알아야 할 때만 채운다.
   * (예: 여러 SKU 를 한 번에 담다가 하나가 재고 부족)
   * 값이 없으면 응답에 키 자체가 나가지 않아 기존 에러 모양 그대로다.
   */
  private readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    code: ServiceErrorCode,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.data = data;
  }

  getCode(): ServiceErrorCode {
    return this.code;
  }

  getData(): Record<string, unknown> | undefined {
    return this.data;
  }

  getStatus(): HttpStatus {
    return ServiceErrorStatus[this.code];
  }
}

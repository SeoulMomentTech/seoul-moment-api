import { HttpStatus } from '@nestjs/common';

import { ServiceErrorCode, ServiceErrorStatus } from './dto/exception.dto';

export class ServiceError extends Error {
  private readonly code: ServiceErrorCode;

  constructor(message: string, code: ServiceErrorCode) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }

  getCode(): ServiceErrorCode {
    return this.code;
  }

  getStatus(): HttpStatus {
    return ServiceErrorStatus[this.code];
  }
}

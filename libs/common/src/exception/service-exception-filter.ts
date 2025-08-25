/* eslint-disable import/order */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';

import { ServiceError } from './service.error';
import { LoggerService } from '../log/logger.service';

@Catch(ServiceError)
@Injectable()
export class ServiceErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: ServiceError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStstus();

    this.logger.error('service exception', exception, {
      message: exception.message,
      status,
      stack: exception.stack,
    });

    response.status(status).json({
      message: exception.message,
      code: exception.getCode(),
      tracdId: this.logger.getTraceId(),
    });
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';

import { LoggerService } from '../log/logger.service';

@Catch(HttpException)
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    const error =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : exceptionResponse;

    this.logger.error('http exception', error, {
      status,
      code: HttpStatus[status],
      stack: exception.stack,
    });

    response.status(status).json({
      ...error,
      code: HttpStatus[status],
      tracdId: this.logger.getTraceId(),
    });
  }
}

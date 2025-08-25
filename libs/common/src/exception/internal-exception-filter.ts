import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../log/logger.service';

@Catch(InternalServerErrorException)
@Injectable()
export class InternalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception.message || 'internal service error';
    this.logger.error('http exception', exception, {
      status,
      code: HttpStatus[status],
      stack: exception.stack,
    });

    response.status(status).json({
      message,
      code: HttpStatus[status],
      tracdId: this.logger.getTraceId(),
    });
  }
}

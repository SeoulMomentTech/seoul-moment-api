import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';

import { LoggerService } from '../log/logger.service';

@Catch()
@Injectable()
export class InternalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error('http exception', exception, {
      status,
      code: HttpStatus[status],
      stack: exception?.stack,
    });

    const isProd = Configuration.getConfig().NODE_ENV === SupportEnv.PROD;
    const message = isProd
      ? 'Internal server error'
      : exception?.message || 'internal service error';

    response.status(status).json({
      message,
      code: HttpStatus[status],
      traceId: this.logger.getTraceId(),
    });
  }
}

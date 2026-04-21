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

    const body: Record<string, any> = {
      message,
      code: HttpStatus[status],
      traceId: this.logger.getTraceId(),
    };

    if (!isProd) {
      const error = this.extractErrorDetail(exception);
      if (error) {
        body.error = error;
      }
    }

    response.status(status).json(body);
  }

  private extractErrorDetail(exception: any): Record<string, any> | null {
    if (!exception || typeof exception !== 'object') return null;

    const candidates: Record<string, any> = {
      code: exception.code,
      detail: exception.detail,
      constraint: exception.constraint,
      table: exception.table,
      column: exception.column,
      query: exception.query,
      parameters: exception.parameters,
    };

    // name 은 서브클래스(QueryFailedError, TypeError 등)일 때만 의미가 있음.
    // 기본 Error 는 message 만으로 충분하므로 스킵해 응답 노이즈를 줄인다.
    if (exception.name && exception.name !== 'Error') {
      candidates.name = exception.name;
    }

    const error: Record<string, any> = {};
    for (const [key, value] of Object.entries(candidates)) {
      if (value !== undefined && value !== null) {
        error[key] = value;
      }
    }

    return Object.keys(error).length > 0 ? error : null;
  }
}

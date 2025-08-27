/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { SupportEnv } from '@app/config/enum/config.enum';
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import winston from 'winston';

@Injectable()
export class LoggerService {
  private als = new AsyncLocalStorage();

  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === SupportEnv.PROD ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, ...meta }) => {
          const traceId = this.getTraceId();
          return `${timestamp} [${traceId}] ${level.toUpperCase()} ${
            Object.keys(meta).length ? JSON.stringify(meta) : ''
          }`;
        }),
      ),
      transports: [new winston.transports.Console()],
    });
  }

  scope(traceId: string, callback: () => unknown): unknown {
    return this.als.run(traceId, callback);
  }

  getTraceId(): string {
    return (this.als.getStore() as string) || '0';
  }

  info(message: string, object?: Record<string, any>): void {
    this.logger.info({
      message,
      ...object,
    });
  }

  warn(message: string, object?: Record<string, any>): void {
    this.logger.warn({
      message,
      ...object,
    });
  }
  error(message: string): void;
  error(message: string, error?: any): void;
  error(message: string, error?: any, object?: Record<string, any>): void;
  error(message: string, error?: any, object?: Record<string, any>): void {
    const logObject: Record<string, any> = {
      message,
      ...(object || {}),
    };

    if (error) {
      logObject.error = error;
    }

    this.logger.error(logObject);
  }

  debug(message: string, object?: Record<string, any>): void {
    this.logger.debug({
      message,
      ...object,
    });
  }
}

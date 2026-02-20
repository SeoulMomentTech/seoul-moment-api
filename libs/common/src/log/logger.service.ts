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
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const traceId = this.getTraceId();

          // message가 있으면 이미 포맷팅된 메시지이므로 그대로 사용
          if (message) {
            return `${timestamp} [${traceId}] ${level.toUpperCase()} ${message}`;
          }

          // message가 없으면 meta 객체를 처리
          let logMessage = `${timestamp} [${traceId}] ${level.toUpperCase()}`;

          if (Object.keys(meta).length > 0) {
            const formattedMeta = Object.entries(meta)
              .map(([key, value]) => {
                if (typeof value === 'object') {
                  return `${key}: ${JSON.stringify(value, null, 2)}`;
                } else {
                  return `${key}: ${value}`;
                }
              })
              .join('\n');

            logMessage += `\n${formattedMeta}`;
          }

          return logMessage;
        }),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.simple(),
          ),
        }),
      ],
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
      traceId: this.getTraceId(),
      message,
      ...object,
    });
  }

  warn(message: string, object?: Record<string, any>): void {
    this.logger.warn({
      traceId: this.getTraceId(),
      message,
      ...object,
    });
  }
  error(message: string): void;
  error(message: string, error?: any): void;
  error(message: string, error?: any, object?: Record<string, any>): void;
  error(message: string, error?: any, object?: Record<string, any>): void {
    const logObject: Record<string, any> = {
      traceId: this.getTraceId(),
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
      traceId: this.getTraceId(),
      message,
      ...object,
    });
  }
}

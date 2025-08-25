import { INestApplication } from '@nestjs/common';
import { Application } from 'express';
import type { IncomingMessage } from 'http';
import morganBody from 'morgan-body';
import { LoggerService } from './logger.service';

enum HttpDataType {
  REQUEST_BODY = 'Request Body',
  REQUEST = 'Request',
  RESPONSE_BODY = 'Response Body',
  RESPONSE = 'Response',
  HTTP = 'http',
}

function isSkipUrl(req: IncomingMessage): boolean {
  if (
    req.url === '/health' ||
    req.url === '/metrics' ||
    req.url === '/favicon.ico'
  ) {
    return true;
  }

  return false;
}

function convertBodyMessage(message: string) {
  const cleanedMessage = message
    .replace('\n', '')
    .replace(`${HttpDataType.REQUEST_BODY}:`, '')
    .replace(`${HttpDataType.RESPONSE_BODY}:`, '')
    .trim();
    
  try {
    return JSON.parse(cleanedMessage);
  } catch {
    // JSON이 아닌 경우 원본 문자열 반환
    return cleanedMessage;
  }
}

const morganSetting = (app: INestApplication<any>) => {
  const logger = app.get(LoggerService);

  morganBody(app.getHttpAdapter().getInstance() as Application, {
    noColors: true, // 컬러 없이 출력
    prettify: false,

    skip(_req: IncomingMessage) {
      return isSkipUrl(_req);
    },

    stream: {
      write: (message: string) => {
        let convertMessage: Record<string, any>;
        let bodyType: string;

        try {
          if (message.includes(HttpDataType.REQUEST_BODY)) {
            convertMessage = convertBodyMessage(message);
            bodyType = HttpDataType.REQUEST_BODY;

            logger.info(`${bodyType}:`, { body: convertMessage });
          } else if (message.includes(HttpDataType.RESPONSE_BODY)) {
            convertMessage = convertBodyMessage(message);
            bodyType = HttpDataType.RESPONSE_BODY;

            logger.info(`${bodyType}:`, { body: convertMessage });
          } else if (message.includes(HttpDataType.REQUEST)) {
            bodyType = HttpDataType.REQUEST;

            logger.info(
              `${message.match(/Request:\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+([^\s]+)/)[0]}`,
            );
          } else {
            logger.info(message);
          }
        } catch {
          logger.info(message);
        }

        return true;
      },
    },
  });
};

export default morganSetting;

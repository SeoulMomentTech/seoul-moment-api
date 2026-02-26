import { INestApplication } from '@nestjs/common';
import { Application } from 'express';
import type { IncomingMessage } from 'http';
import morgan from 'morgan';
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
  if (req.url === '/metrics' || req.url === '/favicon.ico') {
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

  // ANSI 색상 코드 제거
  const ansiRegex = /\u001b\[[0-9;]*m/g;
  const cleanMessage = cleanedMessage.replace(ansiRegex, '');

  try {
    return JSON.parse(cleanMessage);
  } catch {
    // JSON이 아닌 경우 원본 문자열 반환
    return cleanMessage;
  }
}

/* eslint-disable max-lines-per-function */
function morganSetting(app: INestApplication<any>) {
  const logger = app.get(LoggerService);

  // Request line 로깅 (morgan 사용)
  app.use(
    morgan(
      ':method :url at :date[web] IP: :remote-addr User Agent: :user-agent',
      {
        stream: {
          write: (message: string) => {
            // ANSI 코드 제거 후 로깅
            const ansiRegex = /\u001b\[[0-9;]*m/g;
            const cleanMessage = message.replace(ansiRegex, '');
            logger.info(`Request: ${cleanMessage.trim()}`);
            return true;
          },
        },
        skip: isSkipUrl,
      },
    ),
  );

  // Request/Response body 로깅 (morgan-body 사용)
  morganBody(app.getHttpAdapter().getInstance() as Application, {
    noColors: false, // 컬러 유지
    prettify: false,
    logReqDateTime: false, // request line은 이미 morgan으로 처리
    logReqUserAgent: false,

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

            logger.info(`${bodyType}: ${JSON.stringify(convertMessage)}`);
          } else if (message.includes(HttpDataType.RESPONSE_BODY)) {
            convertMessage = convertBodyMessage(message);
            bodyType = HttpDataType.RESPONSE_BODY;

            logger.info(`${bodyType}: ${JSON.stringify(convertMessage)}`);
          } else {
            // Response status 등의 기타 메시지
            const ansiRegex = /\u001b\[[0-9;]*m/g;
            const cleanMessage = message.replace(ansiRegex, '');
            logger.info(cleanMessage.trim());
          }
        } catch {
          logger.info(message);
        }

        return true;
      },
    },
  });
}

export default morganSetting;
/* eslint-enable max-lines-per-function */

import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { ArgumentsHost, InternalServerErrorException } from '@nestjs/common';

import { InternalExceptionFilter } from '../libs/common/src/exception/internal-exception-filter';
import { LoggerService } from '../libs/common/src/log/logger.service';

describe('InternalExceptionFilter (단위 테스트)', () => {
  let filter: InternalExceptionFilter;
  let logger: LoggerService;

  const buildHost = () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const response = { status };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  const mockEnv = (env: SupportEnv) => {
    jest
      .spyOn(Configuration, 'getConfig')
      .mockReturnValue({ NODE_ENV: env } as any);
  };

  beforeEach(() => {
    logger = new LoggerService();
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    filter = new InternalExceptionFilter(logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('일반 Error 를 500 응답으로 변환하고 traceId 와 상세 메시지를 포함한다', () => {
    // Given
    mockEnv(SupportEnv.TEST);
    const { host, status, json } = buildHost();
    const exception = new Error('boom');

    // When
    logger.scope('trace-123', () => filter.catch(exception, host));

    // Then
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: 'boom',
      code: 'INTERNAL_SERVER_ERROR',
      traceId: 'trace-123',
    });
  });

  it('InternalServerErrorException 도 여전히 같은 포맷으로 처리된다', () => {
    // Given
    mockEnv(SupportEnv.TEST);
    const { host, status, json } = buildHost();
    const exception = new InternalServerErrorException('db down');

    // When
    logger.scope('trace-abc', () => filter.catch(exception, host));

    // Then
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: 'db down',
      code: 'INTERNAL_SERVER_ERROR',
      traceId: 'trace-abc',
    });
  });

  it('prod 환경에서는 exception.message 를 노출하지 않고 고정 메시지를 반환한다', () => {
    // Given
    mockEnv(SupportEnv.PROD);
    const { host, status, json } = buildHost();
    const exception = new Error('QueryFailedError: sensitive DB leak');

    // When
    logger.scope('trace-prod', () => filter.catch(exception, host));

    // Then
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      traceId: 'trace-prod',
    });
  });

  it('prod 가 아닌 환경에서 exception.message 가 비어 있으면 기본 메시지로 대체한다', () => {
    // Given
    mockEnv(SupportEnv.LOCAL);
    const { host, json } = buildHost();
    const exception = new Error('');

    // When
    logger.scope('trace-empty', () => filter.catch(exception, host));

    // Then
    expect(json).toHaveBeenCalledWith({
      message: 'internal service error',
      code: 'INTERNAL_SERVER_ERROR',
      traceId: 'trace-empty',
    });
  });

  it('traceId scope 바깥에서 호출되면 "0" 을 반환한다', () => {
    // Given
    mockEnv(SupportEnv.DEV);
    const { host, json } = buildHost();

    // When
    filter.catch(new Error('no scope'), host);

    // Then
    expect(json).toHaveBeenCalledWith({
      message: 'no scope',
      code: 'INTERNAL_SERVER_ERROR',
      traceId: '0',
    });
  });

  it('error 로그는 환경과 무관하게 원본 exception 을 전달한다 (prod 로그 유지 검증)', () => {
    // Given
    mockEnv(SupportEnv.PROD);
    const errorSpy = jest.spyOn(logger, 'error');
    const { host } = buildHost();
    const exception = new Error('sensitive');

    // When
    logger.scope('trace-log', () => filter.catch(exception, host));

    // Then
    expect(errorSpy).toHaveBeenCalledWith(
      'http exception',
      exception,
      expect.objectContaining({ status: 500, code: 'INTERNAL_SERVER_ERROR' }),
    );
  });
});

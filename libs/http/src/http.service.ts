/* eslint-disable max-lines-per-function */
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { LoggerService } from '@app/common/log/logger.service';
import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class HttpRequestService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  async sendPostRequest<T>(
    url: string,
    body: Record<string, any>,
    headers?: Record<string, any>,
  ): Promise<{ result: boolean; data: T }> {
    this.logger.info('Post request', {
      url,
      body,
      headers,
    });

    try {
      const res$ = this.httpService.post(url, body, { headers });
      const { data } = await lastValueFrom(res$);

      this.logger.info('Post response', {
        data,
      });

      return { result: true, data };
    } catch (error) {
      if (error.status === HttpStatus.UNAUTHORIZED) {
        throw new ServiceError(
          `sendPostRequest UNAUTHORIZED Error url: ${url}`,
          ServiceErrorCode.UNAUTHORIZED,
        );
      } else if (error.status === HttpStatus.BAD_REQUEST) {
        throw new ServiceError(
          `sendPostRequest BAD_REQUEST Error url: ${url}`,
          ServiceErrorCode.BAD_REQUEST,
        );
      } else if (error.status === HttpStatus.FORBIDDEN) {
        throw new ServiceError(
          `sendPostRequest FORBIDDEN Error url: ${url}`,
          ServiceErrorCode.FORBIDDEN,
        );
      } else if (error.status === HttpStatus.GONE) {
        throw new ServiceError(
          `sendPostRequest GONE Error url: ${url}`,
          ServiceErrorCode.GONE,
        );
      }
      throw new ServiceError(
        `sendPostRequest Error url: ${url}`,
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendGetRequest<T>(
    url: string,
    query: Record<string, any>,
    headers?: Record<string, any>,
  ): Promise<{ result: boolean; data: T }> {
    this.logger.info('Post request', {
      url,
      query,
      headers,
    });

    try {
      const res$ = this.httpService.get(url, { headers, params: query });
      const { data } = await lastValueFrom(res$);

      this.logger.info('Post response', {
        data,
      });

      return { result: true, data };
    } catch (error) {
      if (error.status === HttpStatus.UNAUTHORIZED) {
        this.logger.error(
          'sendGetRequest UNAUTHORIZED Error url: ${url}',
          error,
        );
        throw new ServiceError(
          `sendGetRequest UNAUTHORIZED Error url: ${url}`,
          ServiceErrorCode.UNAUTHORIZED,
        );
      } else if (error.status === HttpStatus.BAD_REQUEST) {
        throw new ServiceError(
          `sendGetRequest BAD_REQUEST Error url: ${url}`,
          ServiceErrorCode.BAD_REQUEST,
        );
      } else if (error.status === HttpStatus.FORBIDDEN) {
        throw new ServiceError(
          `sendGetRequest FORBIDDEN Error url: ${url}`,
          ServiceErrorCode.FORBIDDEN,
        );
      } else if (error.status === HttpStatus.GONE) {
        throw new ServiceError(
          `sendGetRequest GONE Error url: ${url}`,
          ServiceErrorCode.GONE,
        );
      }
      throw new ServiceError(
        `sendGetRequest Error url: ${url}`,
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

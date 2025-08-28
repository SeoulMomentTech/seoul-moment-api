import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { LoggerService } from '@app/common/log/logger.service';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
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
      this.logger.error(`sendPostRequest Error url: ${url}`, error);

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
      this.logger.error(`sendPostRequest Error url: ${url}`, error);

      throw new ServiceError(
        `sendPostRequest Error url: ${url}`,
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

import { HttpModule, HttpService } from '@nestjs/axios';
import { Module, OnModuleInit } from '@nestjs/common';
import qs from 'qs';

import { HttpRequestService } from './http.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 10000,
        maxRedirects: 5,
        retries: 1,
        retryDelay: () => 50,
        paramsSerializer: (params) =>
          qs.stringify(params, { arrayFormat: 'repeat' }),
      }),
    }),
  ],
  providers: [HttpRequestService],
  exports: [HttpRequestService],
})
export class HttpRequestModule implements OnModuleInit {
  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    this.httpService.axiosRef.interceptors.request.use(
      (request) => request,
      (error) => {
        throw error;
      },
    );

    this.httpService.axiosRef.interceptors.response.use(
      (response) => response,
      (error) => {
        throw error;
      },
    );
  }
}

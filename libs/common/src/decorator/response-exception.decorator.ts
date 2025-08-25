import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export const ResponseException = (status: HttpStatus, description: string) =>
  applyDecorators(
    ApiResponse({
      status,
      schema: {
        allOf: [
          {
            properties: {
              message: {
                type: 'string',
                example: 'any message',
              },
              code: {
                type: 'string',
                example: HttpStatus[status],
              },
              traceId: {
                type: 'string',
                example: '1827340b-0ca5-41ef-ba2b-3492c735ce27',
              },
            },
          },
        ],
      },
      description,
    }),
  );

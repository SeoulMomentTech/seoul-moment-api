import { applyDecorators, HttpCode, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export const ResponseList = <TModel extends Type<unknown>>(
  model: TModel,
  status = HttpStatus.OK,
) =>
  applyDecorators(
    HttpCode(status),
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              result: {
                type: 'boolean',
                example: true,
              },
              data: {
                type: 'object',
                properties: {
                  total: {
                    type: 'number',
                    example: 0,
                  },
                  list: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );

import { INestApplication, Type } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { SwaggerAuthName } from './swagger.dto';

const SWAGGER_DOCS_PATH = 'docs';

export interface SwaggerSettingOptions {
  /** docs에 포함할 모듈. 지정 시 이 모듈들만 /docs, /docs-json에 노출 */
  docsInclude?: Type[];
}

export function swaggerSettring(
  app: INestApplication,
  options?: SwaggerSettingOptions,
) {
  const config = new DocumentBuilder()
    .setTitle('Api Document')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      SwaggerAuthName.ACCESS_TOKEN,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: options?.docsInclude?.length ? options.docsInclude : undefined,
  });

  SwaggerModule.setup(SWAGGER_DOCS_PATH, app, document);
}

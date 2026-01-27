import { INestApplication, Type } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { SwaggerAuthName } from './swagger.dto';

const SWAGGER_DOCS_PATH = 'docs';
const SWAGGER_DOCS_PLEN_PATH = 'docs-plen';

export interface SwaggerSettingOptions {
  /** docs-plen에 노출할 모듈. 이 모듈에 속한 컨트롤러만 문서에 표시 */
  plenInclude?: Type[];
}

export function swaggerSettring(
  app: INestApplication,
  options?: SwaggerSettingOptions,
) {
  const config = new DocumentBuilder()
    .setTitle('Api Document')
    .setDescription(
      'JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbklkIjoxLCJqd3RUeXBlIjoiT05FX1RJTUVfVElNRSIsImlhdCI6MTc2NDA0OTUyMiwiZXhwIjoxNzk1NTg1NTIyfQ.EP5ON2wOECVUi616lCTaJMNeV5JUn-6kvMd4ucN6js0',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      SwaggerAuthName.ACCESS_TOKEN,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_DOCS_PATH, app, document);

  // /docs-plen: plen 전용 문서 (설정·포함 모듈 등을 따로 관리 가능)
  const plenConfig = new DocumentBuilder()
    .setTitle('Plen Api Document')
    .setDescription(
      'Plen 전용 API 문서. 필요시 include 옵션으로 특정 모듈만 포함 가능.',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      SwaggerAuthName.ACCESS_TOKEN,
    )
    .build();

  const plenDocument = SwaggerModule.createDocument(
    app,
    plenConfig,
    options?.plenInclude?.length ? { include: options.plenInclude } : undefined,
  );
  SwaggerModule.setup(SWAGGER_DOCS_PLEN_PATH, app, plenDocument);
}

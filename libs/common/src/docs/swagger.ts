import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { SwaggerAuthName } from './swagger.dto';

export function swaggerSettring(app: INestApplication) {
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

  SwaggerModule.setup('docs', app, document);
}

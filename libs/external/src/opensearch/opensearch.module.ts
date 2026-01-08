import { Configuration } from '@app/config/configuration';
import { Module } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';

import { OpensearchService } from './opensearch.service';

const OPENSEARCH_CLIENT = 'OPENSEARCH_CLIENT';

const opensearchProvider = {
  provide: OPENSEARCH_CLIENT,
  useFactory: () => {
    const config = Configuration.getConfig();
    return new Client({
      node: config.OPENSEARCH_HOST,
      auth: {
        username: config.OPENSEARCH_NAME,
        password: config.OPENSEARCH_PASS,
      },
      ssl: {
        rejectUnauthorized: false, // 개발 환경에서는 false, 프로덕션에서는 true로 설정
      },
    });
  },
};

@Module({
  providers: [opensearchProvider, OpensearchService],
  exports: [OpensearchService, OPENSEARCH_CLIENT],
})
export class OpensearchModule {}

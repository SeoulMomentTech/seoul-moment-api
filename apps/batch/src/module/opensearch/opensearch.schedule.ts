import { LoggerService } from '@app/common/log/logger.service';
import { Injectable } from '@nestjs/common';

import { OpensearchService } from './opensearch.service';

@Injectable()
export class OpensearchSchedule {
  constructor(
    private readonly opensearchService: OpensearchService,
    private readonly logger: LoggerService,
  ) {}

  async handleInitializeIndex() {
    this.logger.info('OpenSearch 상품 데이터 동기화 시작');
    await this.opensearchService.syncProductData();
    this.logger.info('OpenSearch 상품 데이터 동기화 완료');
  }
}

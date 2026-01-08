import { LoggerService } from '@app/common/log/logger.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { OpensearchService } from './opensearch.service';

@Injectable()
export class OpensearchSchedule {
  constructor(
    private readonly opensearchService: OpensearchService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 매일 자정에 OpenSearch 인덱스 초기화
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleInitializeIndex() {
    this.logger.info('OpenSearch 상품 데이터 동기화 시작');
    await this.opensearchService.syncProductData();
    this.logger.info('OpenSearch 상품 데이터 동기화 완료');
  }
}

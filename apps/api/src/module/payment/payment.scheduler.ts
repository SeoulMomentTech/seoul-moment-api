import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';

import { PaymentBatchService } from './payment-batch.service';
import { PAYMENT_BATCH_LOCK_SECONDS } from './payment.constant';

/**
 * 5분마다 결제 배치를 돌린다. ECS 태스크가 여러 개여도 Redis 락으로 한 곳에서만 돈다.
 * 테스트 환경에서는 돌리지 않는다 — 통합 테스트가 5분을 넘기면 테스트 데이터를 건드린다.
 */
@Injectable()
export class PaymentScheduler {
  private readonly logger = new Logger(PaymentScheduler.name);

  constructor(
    private readonly paymentBatchService: PaymentBatchService,
    private readonly cacheService: CacheService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    if (Configuration.getConfig().NODE_ENV === SupportEnv.TEST) {
      return;
    }

    const owner = randomUUID();
    const locked = await this.cacheService
      .setIfAbsent(
        RedisKey.PAYMENT_BATCH_LOCK,
        owner,
        PAYMENT_BATCH_LOCK_SECONDS,
      )
      .catch(() => false);

    if (!locked) {
      return;
    }

    try {
      await this.paymentBatchService.runAll();
    } catch (error) {
      this.logger.error(`payment batch failed: ${error}`);
    } finally {
      await this.cacheService
        .deleteIfValue(RedisKey.PAYMENT_BATCH_LOCK, owner)
        .catch(() => undefined);
    }
  }
}

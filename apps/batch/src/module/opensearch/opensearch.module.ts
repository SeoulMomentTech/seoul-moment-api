import { LoggerModule } from '@app/common/log/logger.module';
import { OpensearchModule as ExternalOpensearchModule } from '@app/external/opensearch/opensearch.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductModule } from 'apps/api/src/module/product/product.module';

import { OpensearchSchedule } from './opensearch.schedule';
import { OpensearchService } from './opensearch.service';

@Module({
  imports: [
    ProductModule,
    RepositoryModule,
    ExternalOpensearchModule,
    ScheduleModule.forRoot(),
    LoggerModule,
  ],
  providers: [OpensearchSchedule, OpensearchService],
})
export class OpensearchModule {}

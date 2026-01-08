import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';

@Module({
  imports: [RepositoryModule],
  controllers: [PartnerController],
  providers: [PartnerService],
})
export class PartnerModule {}

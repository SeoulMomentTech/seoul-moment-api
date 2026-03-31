import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminHomeController } from './admin.home.controller';
import { AdminHomeService } from './admin.home.service';
import { AdminHomeV1Controller } from './v1/admin.home.v1.controller';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminHomeController, AdminHomeV1Controller],
  providers: [AdminHomeService],
  exports: [AdminHomeService],
})
export class AdminHomeModule {}

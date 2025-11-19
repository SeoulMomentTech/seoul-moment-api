import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminHomeController } from './admin.home.controller';
import { AdminHomeService } from './admin.home.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminHomeController],
  providers: [AdminHomeService],
  exports: [AdminHomeService],
})
export class AdminHomeModule {}

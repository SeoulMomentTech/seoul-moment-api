import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

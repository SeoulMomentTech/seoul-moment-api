import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [RepositoryModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}

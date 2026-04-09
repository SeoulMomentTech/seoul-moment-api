import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { HomeV1Controller } from './v1/home.v1.controller';

@Module({
  imports: [RepositoryModule],
  controllers: [HomeController, HomeV1Controller],
  providers: [HomeService],
})
export class HomeModule {}

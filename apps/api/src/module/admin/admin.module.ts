import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { OneTimeTokenStrategy } from 'apps/api/src/strategy/one-time-token.strategy';
import { RefreshTokenStrategy } from 'apps/api/src/strategy/refresh-token.strategy';

import { AdminAuthModule } from './auth/admin.auth.module';
import { AdminBrandModule } from './brand/admin.brand.module';
import { AdminCategoryModule } from './category/admin.category.module';
import { AdminHomeModule } from './home/admin.home.module';
import { AdminImageModule } from './image/admin.image.module';
import { AdminNewsModule } from './news/admin.news.module';

@Module({
  imports: [
    RepositoryModule,
    AdminHomeModule,
    AdminCategoryModule,
    AdminBrandModule,
    AdminImageModule,
    AdminAuthModule,
    AdminNewsModule,
  ],
  providers: [OneTimeTokenStrategy, RefreshTokenStrategy],
})
export class AdminModule {}

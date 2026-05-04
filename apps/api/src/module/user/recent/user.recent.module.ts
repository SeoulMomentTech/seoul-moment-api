import { CommonAuthModule } from '@app/auth/auth.module';
import { CacheModule } from '@app/cache/cache.module';
import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { UserRecentController } from './user.recent.controller';
import { UserRecentService } from './user.recent.service';

@Module({
  imports: [
    RepositoryModule,
    CacheModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
  ],
  controllers: [UserRecentController],
  providers: [UserRecentService],
})
export class UserRecentModule {}

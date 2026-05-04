import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { UserOneTimeTokenStrategy } from 'apps/api/src/strategy/user-one-time-token.strategy';
import { UserRefreshTokenStrategy } from 'apps/api/src/strategy/user-refresh-token.strategy';

import { UserAuthModule } from './auth/user.auth.module';
import { UserLikeModule } from './like/user.like.module';
import { UserRecentModule } from './recent/user.recent.module';

@Module({
  imports: [RepositoryModule, UserAuthModule, UserLikeModule, UserRecentModule],
  providers: [UserOneTimeTokenStrategy, UserRefreshTokenStrategy],
})
export class UserModule {}

import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { UserOneTimeTokenStrategy } from 'apps/api/src/strategy/user-one-time-token.strategy';
import { UserRefreshTokenStrategy } from 'apps/api/src/strategy/user-refresh-token.strategy';

import { UserAuthModule } from './auth/user.auth.module';

@Module({
  imports: [RepositoryModule, UserAuthModule],
  providers: [UserOneTimeTokenStrategy, UserRefreshTokenStrategy],
})
export class UserModule {}

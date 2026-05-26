import { S3Module } from '@app/external/aws/aws.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { UserOneTimeTokenStrategy } from 'apps/api/src/strategy/user-one-time-token.strategy';
import { UserRefreshTokenStrategy } from 'apps/api/src/strategy/user-refresh-token.strategy';

import { UserAuthModule } from './auth/user.auth.module';
import { UserImageModule } from './image/user.image.module';
import { UserLikeModule } from './like/user.like.module';
import { UserRecentModule } from './recent/user.recent.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    RepositoryModule,
    S3Module,
    UserAuthModule,
    UserImageModule,
    UserLikeModule,
    UserRecentModule,
  ],
  controllers: [UserController],
  providers: [UserService, UserOneTimeTokenStrategy, UserRefreshTokenStrategy],
})
export class UserModule {}

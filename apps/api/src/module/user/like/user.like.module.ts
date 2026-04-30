import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { UserLikeController } from './user.like.controller';
import { UserLikeService } from './user.like.service';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
  ],
  controllers: [UserLikeController],
  providers: [UserLikeService],
})
export class UserLikeModule {}

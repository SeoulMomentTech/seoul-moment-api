import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { ExternalGoogleModule } from '@app/external/google/google.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { UserAuthController } from './user.auth.controller';
import { UserAuthService } from './user.auth.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
    AuthModule,
    ExternalGoogleModule,
  ],
  controllers: [UserAuthController],
  providers: [UserAuthService],
  exports: [UserAuthService],
})
export class UserAuthModule {}

import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminAuthController } from './admin.auth.controller';
import { AdminAuthService } from './admin.auth.service';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}

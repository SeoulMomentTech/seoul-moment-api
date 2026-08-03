import { CacheModule } from '@app/cache/cache.module';
import { Configuration } from '@app/config/configuration';
import { GeminiModule } from '@app/external/gemini/gemini.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AiConsultController } from './ai-consult.controller';
import { AiConsultService } from './ai-consult.service';
import { OptionalUserGuard } from '../../guard/optional-user.guard';

@Module({
  imports: [
    RepositoryModule,
    // CacheModule 은 global 이 아니라 명시적으로 import 해야 한다.
    CacheModule,
    GeminiModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [AiConsultController],
  providers: [AiConsultService, OptionalUserGuard],
})
export class AiConsultModule {}

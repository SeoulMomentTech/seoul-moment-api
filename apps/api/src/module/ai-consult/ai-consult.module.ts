import { CacheModule } from '@app/cache/cache.module';
import { Configuration } from '@app/config/configuration';
import { GeminiModule } from '@app/external/gemini/gemini.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AiConsultController } from './ai-consult.controller';
import { AiConsultService } from './ai-consult.service';
import { OptionalUserGuard } from '../../guard/optional-user.guard';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [
    RepositoryModule,
    // CacheModule 은 global 이 아니라 명시적으로 import 해야 한다.
    CacheModule,
    GeminiModule,
    // 상품 조회는 ProductService 를 그대로 재사용한다 — 다국어·좋아요 조립을
    // 여기서 다시 만들면 상품 목록 API 와 결과가 갈라진다.
    ProductModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  controllers: [AiConsultController],
  providers: [AiConsultService, OptionalUserGuard],
})
export class AiConsultModule {}

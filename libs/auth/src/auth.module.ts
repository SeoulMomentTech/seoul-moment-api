import { CacheModule } from '@app/cache/cache.module';
import { ExternalGoogleModule } from '@app/external/google/google.module';
import { HttpRequestModule } from '@app/http/http.module';
import { DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CommonAuthService } from './auth.service';

export class CommonAuthModule {
  static forRoot(secret?: string): DynamicModule {
    return {
      module: CommonAuthModule,
      imports: [
        JwtModule.register({
          secret: secret ?? 'default-secret',
        }),
        ExternalGoogleModule,
        CacheModule,
        HttpRequestModule,
      ],
      providers: [CommonAuthService],
      exports: [CommonAuthService],
    };
  }
}

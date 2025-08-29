import { CacheModule } from '@app/cache/cache.module';
import { ExternalGoogleModule } from '@app/external/google/google.module';
import { SerperModule } from '@app/external/serper/serper.module';
import { Module } from '@nestjs/common';

import { GoogleSheetService } from './google-sheet.service';

@Module({
  imports: [ExternalGoogleModule, CacheModule, SerperModule],
  providers: [GoogleSheetService],
  exports: [GoogleSheetService],
})
export class GoogleSheetModule {}

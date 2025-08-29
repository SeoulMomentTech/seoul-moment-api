import { GoogleSheetModule } from '@app/common/module/google-sheet/google-sheet.module';
import { ExternalGoogleModule } from '@app/external/google/google.module';
import { Module } from '@nestjs/common';

import { GoogleController } from './google.controller';

@Module({
  imports: [GoogleSheetModule, ExternalGoogleModule],
  controllers: [GoogleController],
})
export class GoogleModule {}

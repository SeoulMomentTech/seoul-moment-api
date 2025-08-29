import { GoogleSheetModule } from '@app/common/module/google-sheet/google-sheet.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { GoogleSchedule } from './google.schedule';

@Module({
  imports: [GoogleSheetModule, ScheduleModule.forRoot()],
  providers: [GoogleSchedule],
})
export class GoogleModule {}

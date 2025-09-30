import { GoogleSheetService } from '@app/common/module/google-sheet/google-sheet.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class GoogleSchedule {
  constructor(private readonly googleSheetService: GoogleSheetService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'Asia/Seoul' })
  async cronNewsCrawling() {
    await this.googleSheetService.progressGoogleSheet();
  }
}

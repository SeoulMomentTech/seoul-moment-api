import { GoogleSheetService } from '@app/common/module/google-sheet/google-sheet.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GoogleSchedule {
  constructor(private readonly googleSheetService: GoogleSheetService) {}

  async cronNewsCrawling() {
    await this.googleSheetService.progressGoogleSheet();
  }
}

import { PostGoogleSheetKeywordRequest } from '@app/common/module/google-sheet/google-sheet.dto';
import { GoogleSheetService } from '@app/common/module/google-sheet/google-sheet.service';
import { ExternalGoogleMailService } from '@app/external/google/google-mail.service';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { PostGoogleEmailRequest } from './google.dto';

@Controller('google')
export class GoogleController {
  constructor(
    private readonly googleSheetService: GoogleSheetService,
    private readonly googleMailService: ExternalGoogleMailService,
  ) {}

  @Post('sheet/keyword')
  @ApiOperation({ summary: '크롤링 키워드 업데이트' })
  @HttpCode(HttpStatus.OK)
  async updateGoogleSheetKeyword(@Body() body: PostGoogleSheetKeywordRequest) {
    await this.googleSheetService.updateGoogleSheetKeyword(body.keywordList);
  }

  @Post('sheet/run')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '크롤링 실행' })
  async runCrawring() {
    await this.googleSheetService.progressGoogleSheet();
  }

  @Post('email')
  @ApiOperation({ summary: '이메일 발송' })
  @HttpCode(HttpStatus.OK)
  async postGoogleEmail(@Body() body: PostGoogleEmailRequest) {
    this.googleMailService.sendMail(
      body.to,
      body.name,
      body.subject,
      body.html,
      body.cc,
    );
  }
}

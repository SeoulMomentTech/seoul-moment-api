import { Configuration } from '@app/config/configuration';
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import path from 'path';

import { ExternalGoogleMailService } from './google-mail.service';
import { ExternalGoogleSheetService } from './google-sheet.service';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        service: 'gmail',
        auth: {
          user: 'seoulmomenttw@gmail.com',
          pass: Configuration.getConfig().GOOGLE_APP_PASS,
        },
      },
      defaults: {
        from: 'SeoulMoment <seoulmomenttw@gmail.com>',
      },
      template: {
        dir: path.join(process.cwd(), 'public', 'templates'), // 기본 경로
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  providers: [ExternalGoogleSheetService, ExternalGoogleMailService],
  exports: [ExternalGoogleSheetService, ExternalGoogleMailService],
})
export class ExternalGoogleModule {}

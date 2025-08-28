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
          pass: 'rupwwojavqopkayp',
        },
      },
      defaults: {
        from: 'SeoulMoment <seoulmomenttw@gmail.com>',
      },
      template: {
        dir: path.join(process.cwd(), 'public', 'templates'), // ← 중요!
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

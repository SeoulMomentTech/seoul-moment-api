import { Configuration } from '@app/config/configuration';
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import path from 'path';

import { ExternalGoogleAuthService } from './google-auth.service';
import { ExternalGoogleMailService } from './google-mail.service';
import { ExternalGoogleSheetService } from './google-sheet.service';

@Module({
  imports: [
    MailerModule.forRoot({
      // service: 'gmail' 프리셋은 465(SSL)로 붙고 타임아웃이 기본값(2분)이라,
      // 아웃바운드가 막히면 소켓이 2분씩 물린 채 실패한다. 방화벽 통과율이 더
      // 높은 587(STARTTLS)로 명시하고 타임아웃도 짧게 고정한다.
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: 'seoulmomenttw@gmail.com',
          pass: Configuration.getConfig().GOOGLE_APP_PASS,
        },
        pool: true,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
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
  providers: [
    ExternalGoogleSheetService,
    ExternalGoogleMailService,
    ExternalGoogleAuthService,
  ],
  exports: [
    ExternalGoogleSheetService,
    ExternalGoogleMailService,
    ExternalGoogleAuthService,
  ],
})
export class ExternalGoogleModule {}

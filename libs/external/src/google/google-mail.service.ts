import { HtmlTemplate } from '@app/common/templates/templates.enum';
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class ExternalGoogleMailService {
  constructor(private readonly mailService: MailerService) {}

  sendMail(
    to: string,
    name: string,
    subject: string,
    html: string,
    cc: string[] = [],
  ) {
    this.mailService
      .sendMail({
        from: `${name} <seoulmomenttw@gmail.com>`,
        to,
        subject,
        html,
        cc: cc.join(','),
        replyTo: to,
      })
      .catch((err) => {
        console.error('이메일 전송 실패:', err.message);
      });
  }

  sendMailByTemplate(
    to: string,
    subject: string,
    template: HtmlTemplate,
    context: Record<string, any>,
  ) {
    this.mailService
      .sendMail({
        to,
        subject,
        template,
        context,
      })
      .catch((err) => {
        console.error('이메일 전송 실패:', err.message);
      });
  }
}

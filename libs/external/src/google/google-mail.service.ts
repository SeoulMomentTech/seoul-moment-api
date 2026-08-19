import { LoggerService } from '@app/common/log/logger.service';
import { HtmlTemplate } from '@app/common/templates/templates.enum';
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

/**
 * 메일 발송은 실패를 삼키지 않고 호출자에게 던진다.
 * 인증 코드처럼 사용자가 결과를 기다리는 메일이 조용히 실패하면
 * 사용자는 오지 않는 메일을 계속 기다리고, 서버는 정상이라고 믿게 된다.
 * 호출자는 반드시 await 해서 실패를 처리해야 한다.
 */
@Injectable()
export class ExternalGoogleMailService {
  constructor(
    private readonly mailService: MailerService,
    private readonly logger: LoggerService,
  ) {}

  async sendMail(
    to: string,
    name: string,
    subject: string,
    html: string,
    cc: string[] = [],
  ): Promise<void> {
    try {
      await this.mailService.sendMail({
        from: `${name} <seoulmomenttw@gmail.com>`,
        to,
        subject,
        html,
        cc: cc.join(','),
        replyTo: to,
      });
    } catch (error) {
      this.logger.error('이메일 전송 실패', error, { to, subject });

      throw error;
    }
  }

  async sendMailByTemplate(
    to: string,
    subject: string,
    template: HtmlTemplate,
    context: Record<string, any>,
  ): Promise<void> {
    try {
      await this.mailService.sendMail({
        to,
        subject,
        template,
        context,
      });
    } catch (error) {
      this.logger.error('이메일 전송 실패', error, { to, subject, template });

      throw error;
    }
  }
}

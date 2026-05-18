import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Google 로그인 플로우 수동 테스트 페이지를 서버가 직접 서빙한다.
 *
 * - 개발 편의용 도구이므로 PROD 환경에서는 404로 숨긴다.
 * - 환경별 API base를 HTML에 주입한다 (LOCAL → localhost:3111,
 *   DEV → api-dev.seoulmoment.com.tw). 페이지/API가 동일 origin이라
 *   CORS 없이 동작하고, Google Console에는 그 origin만 등록하면 된다.
 */
@Controller('google_oauth')
export class GoogleOauthTestController {
  @Get()
  serve(@Res() res: Response): void {
    const env = Configuration.getConfig().NODE_ENV;

    if (env === SupportEnv.PROD) {
      throw new NotFoundException();
    }

    const apiBase =
      env === SupportEnv.DEV
        ? 'https://api-dev.seoulmoment.com.tw'
        : 'http://localhost:3111';

    try {
      const html = readFileSync(
        join(process.cwd(), 'public', 'google-auth-test.html'),
        'utf8',
      ).replace(/__API_BASE__/g, apiBase);

      // helmet 기본 COOP(same-origin)이면 Google 로그인 팝업이 opener와
      // postMessage 통신을 못 해 gsi/transform 단계에서 멈춘다.
      // 이 테스트 페이지 응답에 한해서만 완화한다(전역 정책은 그대로).
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      res.type('html').send(html);
    } catch {
      throw new NotFoundException(
        'google-auth-test.html 파일을 찾을 수 없습니다.',
      );
    }
  }
}

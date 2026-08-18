import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * LINE 로그인 백엔드 플로우 수동 테스트 페이지를 서버가 직접 서빙한다(내부용).
 *
 * 실제 클라이언트(React)는 프론트에서(LIFF 등) id_token을 직접 획득하므로
 * 서버의 code→id_token 교환은 두지 않는다. 이 페이지는 그렇게 얻은 id_token을
 * 붙여넣어 /user/auth/line/* 3단계 플로우(로그인·연결확인·신규가입)만 검증한다.
 *
 * - 개발 편의용이라 PROD 환경에서는 404로 숨긴다.
 * - 페이지/API가 동일 origin이라 CORS 없이 동작한다.
 */
@Controller('line_oauth')
export class LineOauthTestController {
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
        join(process.cwd(), 'public', 'line-auth-test.html'),
        'utf8',
      ).replace(/__API_BASE__/g, apiBase);

      res.type('html').send(html);
    } catch {
      throw new NotFoundException(
        'line-auth-test.html 파일을 찾을 수 없습니다.',
      );
    }
  }
}

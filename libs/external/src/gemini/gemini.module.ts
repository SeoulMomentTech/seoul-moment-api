import { Configuration } from '@app/config/configuration';
import { GoogleGenAI } from '@google/genai';
import { Logger, Module } from '@nestjs/common';

import { GEMINI_CLIENT } from './gemini.dto';
import { GeminiService } from './gemini.service';

/**
 * 키가 없거나 클라이언트 생성이 실패하면 null 을 반환한다.
 * 이 provider 가 throw 하면 앱 부팅 자체가 깨지므로(테스트는 빈 키로 뜬다)
 * "설정 안 됨"을 정상 상태로 다루고, GeminiService 가 호출 없이 폴백한다.
 */
const geminiProvider = {
  provide: GEMINI_CLIENT,
  useFactory: (): GoogleGenAI | null => {
    const logger = new Logger('GeminiModule');
    const config = Configuration.getConfig();

    if (!config.GEMINI_API_KEY) {
      logger.warn('⚠️  [Gemini] API key not configured — AI consult disabled');

      return null;
    }

    try {
      return new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    } catch (error) {
      logger.error(`❌ [Gemini] client init failed: ${error.message}`);

      return null;
    }
  },
};

@Module({
  providers: [geminiProvider, GeminiService],
  exports: [GeminiService, GEMINI_CLIENT],
})
export class GeminiModule {}

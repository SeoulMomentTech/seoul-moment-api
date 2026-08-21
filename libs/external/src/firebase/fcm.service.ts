import { LoggerService } from '@app/common/log/logger.service';
import { Inject, Injectable } from '@nestjs/common';
import { Messaging, MulticastMessage } from 'firebase-admin/messaging';

import {
  FCM_MULTICAST_MAX_TOKENS,
  FcmSendResultDto,
  FIREBASE_MESSAGING,
  INVALID_ARGUMENT_ERROR_CODE,
  isUnregisteredTokenError,
} from './firebase.dto';

interface SendResponse {
  success: boolean;
  error?: { code: string };
}

@Injectable()
export class FcmService {
  constructor(
    @Inject(FIREBASE_MESSAGING) private readonly messaging: Messaging | null,
    private readonly logger: LoggerService,
  ) {}

  /** 서비스 계정 키가 설정되어 실제 발송이 가능한지. */
  isConfigured(): boolean {
    return this.messaging !== null;
  }

  /**
   * data-only 메시지를 여러 기기로 보낸다.
   *
   * notification 필드를 절대 넣지 않는 이유: notification 이 있으면 앱이 백그라운드일 때
   * OS 가 알림을 대신 띄워버려 onMessageReceived 가 호출되지 않는다. 그러면 앱이
   * "지금 보고 있는 방"을 걸러내거나 방별 알림 id 를 나눌 수 없다.
   *
   * 예외를 던지지 않는다 — 푸시 실패가 채팅 저장/전송을 깨뜨리면 안 된다.
   */
  async sendDataMessage(
    tokens: string[],
    data: Record<string, string>,
  ): Promise<FcmSendResultDto> {
    if (!this.messaging || tokens.length === 0) {
      return FcmSendResultDto.skipped();
    }

    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    for (const chunk of this.chunkTokens(tokens)) {
      const message: MulticastMessage = {
        tokens: chunk,
        data,
        // 절전 모드에서도 즉시 깨우려면 high 여야 한다.
        android: { priority: 'high' },
      };

      try {
        const response = await this.messaging.sendEachForMulticast(message);

        successCount += response.successCount;
        failureCount += response.failureCount;
        invalidTokens.push(
          ...this.collectInvalidTokens(chunk, response.responses),
        );

        this.logFailureCodes(response.responses);
      } catch (error) {
        failureCount += chunk.length;
        this.logger.error(`[FCM] multicast failed: ${error.message}`);
      }
    }

    return FcmSendResultDto.from(successCount, failureCount, invalidTokens);
  }

  private chunkTokens(tokens: string[]): string[][] {
    const chunks: string[][] = [];

    for (let i = 0; i < tokens.length; i += FCM_MULTICAST_MAX_TOKENS) {
      chunks.push(tokens.slice(i, i + FCM_MULTICAST_MAX_TOKENS));
    }

    return chunks;
  }

  /**
   * 지워야 할 토큰만 골라낸다.
   *
   * invalid-argument 는 "토큰이 깨졌다"와 "페이로드가 잘못됐다" 양쪽에서 온다.
   * 청크가 통째로 invalid-argument 로 실패했다면 원인은 모두가 공유하는 페이로드 쪽이므로
   * 아무것도 지우지 않는다 — 여기서 지우면 버그 한 번에 기기 토큰을 전부 잃는다.
   */
  private collectInvalidTokens(
    tokens: string[],
    responses: SendResponse[],
  ): string[] {
    const payloadSuspected = responses.every(
      (result) =>
        !result.success && result.error?.code === INVALID_ARGUMENT_ERROR_CODE,
    );

    return responses.reduce<string[]>((acc, result, index) => {
      if (result.success) {
        return acc;
      }

      const code = result.error?.code;
      const isDeadToken =
        isUnregisteredTokenError(code) ||
        (code === INVALID_ARGUMENT_ERROR_CODE && !payloadSuspected);

      if (isDeadToken) {
        acc.push(tokens[index]);
      }

      return acc;
    }, []);
  }

  /** 어떤 코드로 실패했는지 남긴다. 쿼터·자격증명 문제를 로그만 보고 구분하기 위해서다. */
  private logFailureCodes(responses: SendResponse[]): void {
    const codes = [
      ...new Set(
        responses
          .filter((result) => !result.success)
          .map((result) => result.error?.code ?? 'unknown'),
      ),
    ];

    if (codes.length > 0) {
      this.logger.warn(`[FCM] failure codes: ${codes.join(', ')}`);
    }
  }
}

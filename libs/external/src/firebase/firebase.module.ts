import { Configuration } from '@app/config/configuration';
import { Logger, Module } from '@nestjs/common';
import {
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

import { FcmService } from './fcm.service';
import { FIREBASE_APP_NAME, FIREBASE_MESSAGING } from './firebase.dto';

/**
 * 서비스 계정 키는 JSON 원문 그대로도, base64 로 감싼 값도 받는다.
 * ECS/Secrets Manager 처럼 개행이 섞인 값을 다루기 까다로운 곳에서는 base64 가 안전하다.
 */
const parseServiceAccount = (raw: string): ServiceAccount => {
  const json = raw.trimStart().startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf-8');

  const parsed = JSON.parse(json);

  return {
    projectId: parsed.project_id ?? parsed.projectId,
    clientEmail: parsed.client_email ?? parsed.clientEmail,
    // 환경변수를 거치며 개행이 리터럴 "\n"(백슬래시 + n) 두 글자로 굳는 경우가 흔하다.
    // base64/JSON 원문 경로에서는 JSON.parse 가 이미 실제 개행으로 바꿔 주므로 no-op 이고,
    // 값이 한 번 더 이스케이프돼 들어왔을 때만 의미가 있다.
    privateKey: (parsed.private_key ?? parsed.privateKey ?? '').replace(
      /\\n/g,
      '\n',
    ),
  };
};

/**
 * 키가 없거나 초기화가 실패하면 null 을 반환한다.
 * 이 provider 가 throw 하면 앱 부팅 자체가 깨지므로(로컬·테스트는 빈 키로 뜬다)
 * "설정 안 됨"을 정상 상태로 다루고, FcmService 가 호출 없이 건너뛴다.
 */
const firebaseMessagingProvider = {
  provide: FIREBASE_MESSAGING,
  useFactory: (): Messaging | null => {
    const logger = new Logger('FirebaseModule');
    const raw = Configuration.getConfig().FIREBASE_SERVICE_ACCOUNT;

    if (!raw) {
      logger.warn('⚠️  [FCM] service account not configured — push disabled');

      return null;
    }

    try {
      const app =
        getApps().find((v) => v.name === FIREBASE_APP_NAME) ??
        initializeApp(
          { credential: cert(parseServiceAccount(raw)) },
          FIREBASE_APP_NAME,
        );

      return getMessaging(app);
    } catch (error) {
      logger.error(`❌ [FCM] init failed: ${error.message}`);

      return null;
    }
  },
};

@Module({
  providers: [firebaseMessagingProvider, FcmService],
  exports: [FcmService, FIREBASE_MESSAGING],
})
export class FirebaseModule {}

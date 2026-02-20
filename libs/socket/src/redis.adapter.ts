/* eslint-disable max-lines-per-function */
import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';

/** * [CTO 설정]
 * 512 CPU 사양에서는 재시도 간격이 짧으면 로그조차 찍지 못하고
 * 프로세스가 먹통이 됩니다. 최소 2초의 여유를 줍니다.
 */
const MAX_RECONNECT_RETRIES = 10;
const MIN_RECONNECT_DELAY_MS = 2000;
const CONNECT_TOTAL_TIMEOUT_MS = 15000;

/** 객체/에러를 ECS에서 읽을 수 있는 문자열로 변환 ( [object Object] 방지 ) */
function stringifyForLog(value: unknown): string {
  if (value instanceof Error) {
    return `${value.message}\n${value.stack ?? ''}`.trim();
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** ECS CloudWatch 로그용으로 의도적으로 console 사용 */
function log(msg: string, ...args: unknown[]) {
  const rest = args.map((a) => (typeof a === 'object' && a !== null ? stringifyForLog(a) : a));
  // eslint-disable-next-line no-console
  console.log(`[RedisIoAdapter] ${msg}`, ...rest);
}
function logError(msg: string, ...args: unknown[]) {
  const rest = args.map((a) => (typeof a === 'object' && a !== null ? stringifyForLog(a) : a));
  // eslint-disable-next-line no-console
  console.error(`[RedisIoAdapter] ${msg}`, ...rest);
}

function timeoutMs(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Connection timeout after ${ms}ms`)), ms),
  );
}

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const config = Configuration.getConfig();
    const host = config.REDIS_HOST;
    const port = config.REDIS_PORT ?? 6379;

    /** * Factory 설정과 동일하게 DEV 환경에서 TLS(rediss) 활성화
     * ElastiCache 사용 시 필수인 경우가 많습니다.
     */
    const useTls = config.NODE_ENV === SupportEnv.DEV;

    log('🚀 [Step 1] connectToRedis() 초기화 시작');

    if (!host) {
      logError('REDIS_HOST 가 설정되지 않았습니다.');
      throw new Error('Redis adapter: REDIS_HOST is required');
    }

    const protocol = useTls ? 'rediss' : 'redis';
    const url = `${protocol}://${host}:${port}`;
    log(`🔗 [Step 2] 접속 정보 설정 완료: ${url} (TLS: ${useTls})`);

    const socketOptions: any = {
      connectTimeout: 10000,
      reconnectStrategy: (retries: number): number | false => {
        /** * [CTO 핵심 로직]
         * 라이브러리 내부에서 발생하는 재시도를 로그로 강제 출력합니다.
         * 로그가 안 찍히고 CPU만 높다면 여기서 delay를 통해 숨통을 틔워줍니다.
         */
        const delay = Math.max(
          MIN_RECONNECT_DELAY_MS,
          Math.min(retries * 500, 5000),
        );
        /* eslint-disable-next-line no-console */
        console.warn(
          `⚠️ [RedisIoAdapter] 재연결 시도 중... (${retries + 1}/${MAX_RECONNECT_RETRIES}) | 다음 시도까지 ${delay}ms`,
        );

        if (retries >= MAX_RECONNECT_RETRIES) {
          logError(
            `❌ [RedisIoAdapter] 최대 재시도 횟수 초과. 연결을 포기합니다.`,
          );
          return false;
        }
        return delay;
      },
    };

    /** ElastiCache TLS: node-redis는 socket.tls를 boolean으로만 받고, rejectUnauthorized는 socket 직속 */
    if (useTls) {
      socketOptions.tls = true;
      socketOptions.rejectUnauthorized = false;
    }

    const redisConfig = {
      url,
      socket: socketOptions,
    };

    let pubClient: ReturnType<typeof createClient> | undefined;
    let subClient: ReturnType<typeof createClient> | undefined;

    try {
      log('📦 [Step 3] Redis 클라이언트 인스턴스 생성 중...');
      pubClient = createClient(redisConfig);

      log('👯 [Step 4] Sub 클라이언트 복제(duplicate) 중...');
      subClient = pubClient.duplicate();

      /** * [중요] connect() 호출 직전에 에러 리스너를 붙여야
       * 초기 연결 단계의 에러를 놓치지 않습니다.
       */
      pubClient.on('error', (err) =>
        logError('🚨 PubClient Error Event:', err.message),
      );
      subClient.on('error', (err) =>
        logError('🚨 SubClient Error Event:', err.message),
      );

      log('⏳ [Step 5] 실제 연결 시도 (connect()) 시작...');

      /** * 15초 레이스: 연결이 안 되고 버벅거리면 15초 뒤에 강제로 에러를 던집니다.
       * 512 사양에서 서버가 '먹통'이 되어 롤백되는 것을 방지합니다.
       */
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        timeoutMs(CONNECT_TOTAL_TIMEOUT_MS),
      ]);

      log('✅ [Step 6] Redis 어댑터 연결 최종 성공!');
      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (error) {
      logError('❌ [Critical] Redis 연결 프로세스 중 치명적 실패 발생', error);

      /** 연결 실패 시 자원 정리: 좀비 커넥션 방지 */
      try {
        if (typeof pubClient?.quit === 'function')
          await pubClient.quit().catch(() => {});
        if (typeof subClient?.quit === 'function')
          await subClient.quit().catch(() => {});
      } catch {
        // ignore
      }

      // 서버 부팅을 중단시키고 롤백을 유도하여 에러를 즉시 인지하게 함
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

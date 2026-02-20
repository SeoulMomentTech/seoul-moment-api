/* eslint-disable max-lines-per-function */

import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';

const MAX_RECONNECT_RETRIES = 10;
const MIN_RECONNECT_DELAY_MS = 2000;
const CONNECT_TOTAL_TIMEOUT_MS = 15000;

/** ECS CloudWatch에 반드시 남기기 위해 부트스트랩 시점에는 console 사용 */
function log(msg: string, ...args: unknown[]) {
  console.log(`[RedisIoAdapter] ${msg}`, ...args);
}
function logError(msg: string, ...args: unknown[]) {
  console.error(`[RedisIoAdapter] ${msg}`, ...args);
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
    const useTls = config.NODE_ENV === SupportEnv.DEV;

    log('connectToRedis() started');

    if (!host || typeof host !== 'string' || host.trim() === '') {
      logError(
        'REDIS_HOST is missing or empty. Set REDIS_HOST or disable Redis adapter.',
      );
      throw new Error('Redis adapter: REDIS_HOST is required');
    }

    const protocol = useTls ? 'rediss' : 'redis';
    const url = `${protocol}://${host}:${port}`;
    log('connecting to Redis', useTls ? '(TLS)' : '(plain)', url);

    const socketOptions: Record<string, unknown> = {
      connectTimeout: 10000,
      reconnectStrategy: (retries: number): number | false => {
        if (retries >= MAX_RECONNECT_RETRIES) {
          logError(
            `reconnect aborted after ${MAX_RECONNECT_RETRIES} retries`,
          );
          return false;
        }
        const delay = Math.max(
          MIN_RECONNECT_DELAY_MS,
          Math.min(retries * 500, 5000),
        );
        console.warn(
          `[RedisIoAdapter] reconnect attempt ${retries + 1}/${MAX_RECONNECT_RETRIES}, next in ${delay}ms`,
        );
        return delay;
      },
    };
    if (useTls) {
      socketOptions.tls = {};
    }

    const redisConfig = {
      url,
      socket: socketOptions,
    };

    const pubClient = createClient(redisConfig);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logError('PubClient error', err));
    subClient.on('error', (err) => logError('SubClient error', err));

    try {
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        timeoutMs(CONNECT_TOTAL_TIMEOUT_MS),
      ]);
      log('Redis connected successfully');
      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (error) {
      logError('Redis connection failed', error);
      try {
        await pubClient.quit().catch(() => {});
        await subClient.quit().catch(() => {});
      } catch {
        // ignore
      }
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

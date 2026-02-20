import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Configuration } from '@app/config/configuration'; // 본인의 설정 경로에 맞게 조정
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(): Promise<void> {
    const redisConfig = {
      url: `redis://${Configuration.getConfig().REDIS_HOST}:${Configuration.getConfig().REDIS_PORT}`,
      socket: {
        // [CTO 핵심 가이드] 재연결 간격을 강제하여 CPU 폭주 방지
        reconnectStrategy: (retries: number) => {
          const delay = Math.min(retries * 100, 3000); // 최대 3초까지만 지연
          this.logger.warn(`[Redis] 연결 시도 중... (${retries}회): ${delay}ms 뒤 재시도`);
          return delay;
        },
        connectTimeout: 10000, // 10초 이내 연결 안 되면 실패 처리
      },
    };

    // 1. Pub/Sub 전용 클라이언트를 별도로 생성 (기존 캐시 클라이언트와 분리)
    const pubClient = createClient(redisConfig);
    const subClient = pubClient.duplicate();

    // 2. 에러 리스너 등록 (로그에 찍혀야 범인을 잡습니다)
    pubClient.on('error', (err) => this.logger.error('Redis PubClient Error', err));
    subClient.on('error', (err) => this.logger.error('Redis SubClient Error', err));

    try {
      // 3. 병렬 연결 시도
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      this.logger.log('✅ WebSocket Redis Adapter connected successfully');
      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (error) {
      this.logger.error('❌ Redis Connection Failed in Adapter', error);
      // 여기서 에러를 던져서 서버가 Unhealthy 상태임을 ECS에 알림
      throw error; 
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
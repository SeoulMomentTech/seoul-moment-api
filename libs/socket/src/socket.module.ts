import { LoggerModule } from '@app/common/log/logger.module';
import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlanNotificationModule } from 'apps/api/src/module/plen/notification/plan-notification.module';

import { ChatGateway } from './socket.gateway';

@Module({
  imports: [
    LoggerModule,
    RepositoryModule,
    PlanNotificationModule,
    // 소켓 연결 시 handshake 의 토큰을 검증한다
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class SocketModule {}

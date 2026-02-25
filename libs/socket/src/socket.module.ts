import { LoggerModule } from '@app/common/log/logger.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { PlanNotificationModule } from 'apps/api/src/module/plen/notification/plan-notification.module';

import { ChatGateway } from './socket.gateway';

@Module({
  imports: [LoggerModule, RepositoryModule, PlanNotificationModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class SocketModule {}

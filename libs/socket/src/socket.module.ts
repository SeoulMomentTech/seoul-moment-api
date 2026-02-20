import { LoggerModule } from '@app/common/log/logger.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { ChatGateway } from './socket.gateway';

@Module({
  imports: [LoggerModule, RepositoryModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class SocketModule {}

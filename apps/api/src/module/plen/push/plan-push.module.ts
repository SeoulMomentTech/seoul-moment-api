import { FirebaseModule } from '@app/external/firebase/firebase.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { PlanPushService } from './plan-push.service';

@Module({
  imports: [RepositoryModule, FirebaseModule],
  providers: [PlanPushService],
  exports: [PlanPushService],
})
export class PlanPushModule {}

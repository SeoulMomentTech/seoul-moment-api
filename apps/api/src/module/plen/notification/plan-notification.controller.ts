import { LoggerService } from '@app/common/log/logger.service';
import { Controller, Param, ParseIntPipe, Sse } from '@nestjs/common';
import { interval, map, merge, Observable, tap } from 'rxjs';

import { PlanNotificationMessageDto } from './plan-notification.dto';
import { PlanNotificationService } from './plan-notification.service';

@Controller('plan/notification')
export class PlanNotificationController {
  constructor(
    private readonly planNotificationService: PlanNotificationService,
    private readonly logger: LoggerService,
  ) {}

  @Sse('chat/:roomId([0-9]+)')
  sendNotification(
    @Param('roomId', ParseIntPipe) roomId: number,
  ): Observable<{ data: PlanNotificationMessageDto | { type: string } }> {
    this.logger.info(`[SSE CONNECT] Room: ${roomId}`);

    // 1. 실제 데이터 스트림
    const notification$ = this.planNotificationService
      .subscribeRoom(roomId)
      .pipe(
        tap((payload) =>
          this.logger.info(`[SSE MESSAGE] Room: ${roomId}`, { payload }),
        ),
        map((payload) => ({ data: payload })),
      );

    // 2. 하트비트 스트림 (ALB 타임아웃이 60초라면 30초 정도가 적당)
    const heartbeat$ = interval(30000).pipe(
      map(() => ({ data: { type: 'keep-alive' } })),
    );

    return merge(notification$, heartbeat$);
  }
}

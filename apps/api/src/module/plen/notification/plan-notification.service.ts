import { Injectable } from '@nestjs/common';
import { filter, Observable, Subject } from 'rxjs';

import { PlanNotificationMessageDto } from './plan-notification.dto';
import { PlanPushService } from '../push/plan-push.service';

@Injectable()
export class PlanNotificationService {
  private readonly messageSubject = new Subject<PlanNotificationMessageDto>();

  constructor(private readonly planPushService: PlanPushService) {}

  /**
   * SSE 로 흘려보내는 유일한 지점이라, FCM 발송도 여기에 함께 건다.
   * 소켓 게이트웨이든 플랜 공유든 호출부가 늘어도 푸시 누락이 생기지 않는다.
   *
   * 푸시는 기다리지 않는다(fire-and-forget) — SSE 는 즉시 나가야 하고,
   * PlanPushService 는 내부에서 모든 실패를 삼키므로 unhandled rejection 도 나지 않는다.
   */
  emitMessage(message: PlanNotificationMessageDto) {
    this.messageSubject.next(message);

    void this.planPushService.sendChatMessage(message.roomId, message.data);
  }

  subscribeRoom(roomId: number): Observable<PlanNotificationMessageDto> {
    return this.messageSubject.pipe(
      filter((message) => message.roomId === roomId),
    );
  }
}

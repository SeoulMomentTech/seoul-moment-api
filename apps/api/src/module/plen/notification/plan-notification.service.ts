import { Injectable } from '@nestjs/common';
import { filter, Observable, Subject } from 'rxjs';

import { PlanNotificationMessageDto } from './plan-notification.dto';

@Injectable()
export class PlanNotificationService {
  private readonly messageSubject = new Subject<PlanNotificationMessageDto>();

  emitMessage(message: PlanNotificationMessageDto) {
    this.messageSubject.next(message);
  }

  subscribeRoom(roomId: number): Observable<PlanNotificationMessageDto> {
    return this.messageSubject.pipe(
      filter((message) => message.roomId === roomId),
    );
  }
}

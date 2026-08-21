import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { PlanActivityEntity } from '@app/repository/entity/plan-activity.entity';
import {
  PlanActivityTargetType,
  PlanActivityType,
} from '@app/repository/enum/plan-activity.enum';
import { PlanActivityRepositoryService } from '@app/repository/service/plan-activity.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { GetPlanActivityResponse } from './plan-activity.dto';

export interface RecordPlanActivityInput {
  type: PlanActivityType;
  planUserId: string;
  planUserRoomId?: number | null;
  targetType?: PlanActivityTargetType | null;
  targetId?: number | null;
  targetTitle?: string | null;
  amount?: number | null;
}

@Injectable()
export class PlanActivityService {
  private readonly logger = new Logger(PlanActivityService.name);

  constructor(
    private readonly planActivityRepositoryService: PlanActivityRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
  ) {}

  /**
   * 활동을 남긴다.
   *
   * 기록은 부가 기능이다. 여기서 실패해도 원래 동작(플랜 저장 등)까지 같이
   * 실패시키지 않는다. 로그만 남기고 조용히 넘어간다.
   */
  async record(input: RecordPlanActivityInput): Promise<void> {
    try {
      await this.planActivityRepositoryService.create(
        plainToInstance(PlanActivityEntity, {
          type: input.type,
          planUserId: input.planUserId,
          planUserRoomId: input.planUserRoomId ?? null,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          targetTitle: input.targetTitle ?? null,
          amount: input.amount ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to record plan activity type: ${input.type}, planUserId: ${input.planUserId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async getPlanActivityList(
    planUserId: string,
    page: number,
    count: number,
    sort: DatabaseSort,
    roomId?: number,
  ): Promise<[GetPlanActivityResponse[], number]> {
    if (roomId) {
      const member =
        await this.planUserRoomMemberRepositoryService.findByRoomIdAndPlanUserId(
          roomId,
          planUserId,
        );

      if (!member) {
        throw new ServiceError(
          `You are not a member of this room roomId: ${roomId}`,
          ServiceErrorCode.FORBIDDEN,
        );
      }
    }

    const [entities, total] =
      await this.planActivityRepositoryService.findAndCountByScope(
        planUserId,
        roomId ?? null,
        page,
        count,
        sort,
      );

    return [
      entities.map((entity) => GetPlanActivityResponse.from(entity)),
      total,
    ];
  }
}

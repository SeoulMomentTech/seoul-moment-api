/* eslint-disable max-lines-per-function */
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { UpdatePlanScheduleDto } from '@app/repository/dto/plan-schedule.dto';
import { ChatMessageEntity } from '@app/repository/entity/chat-message.entity';
import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import { PlanUserCategoryEntity } from '@app/repository/entity/plan-user-category.entity';
import { ChatMessageType } from '@app/repository/enum/chat-message.enum';
import {
  PlanActivityTargetType,
  PlanActivityType,
} from '@app/repository/enum/plan-activity.enum';
import { PlanScheduleStatus } from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { ChatRepositoryService } from '@app/repository/service/chat.repository.service';
import { PlanCategoryRepositoryService } from '@app/repository/service/plan-category.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetCalendarDayItem,
  GetCalendarListResponse,
  GetPlanScheduleDetailResponse,
  GetPlanScheduleListRequest,
  GetPlanScheduleResponse,
  PatchPlanScheduleRequest,
  PatchPlanScheduleResponse,
  PatchPlanScheduleStatusResponse,
  PostPlanScheduleRequest,
  PostPlanScheduleResponse,
} from './plan-schedule.dto';
import { PlanActivityService } from '../activity/plan-activity.service';
import { PlanNotificationMessageDto } from '../notification/plan-notification.dto';
import { PlanNotificationService } from '../notification/plan-notification.service';

@Injectable()
export class PlanScheduleService {
  constructor(
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planCategoryRepositoryService: PlanCategoryRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
    private readonly planNotificationService: PlanNotificationService,
    private readonly chatMessageRepositoryService: ChatRepositoryService,
    private readonly planActivityService: PlanActivityService,
  ) {}

  @Transactional()
  async postPlanSchedule(
    id: string,
    postPlanScheduleRequest: PostPlanScheduleRequest,
  ): Promise<PostPlanScheduleResponse> {
    if (postPlanScheduleRequest.roomId) {
      const planUserRoom = await this.planUserRoomRepositoryService.getByRoomId(
        postPlanScheduleRequest.roomId,
      );

      const planUserRoomMember =
        await this.planUserRoomMemberRepositoryService.getByRoomIdAndPlanUserId(
          planUserRoom.id,
          id,
        );

      if (planUserRoomMember.permission === PlanUserRoomMemberPermission.READ) {
        throw new ServiceError(
          'You are not allowed to create a plan schedule in this room',
          ServiceErrorCode.FORBIDDEN,
        );
      }
    }

    const planSchedule = await this.planScheduleRepositoryService.create(
      plainToInstance(PlanScheduleEntity, {
        planUserId: id,
        planUserRoomId: postPlanScheduleRequest.roomId,
        categoryName: postPlanScheduleRequest.categoryName,
        title: postPlanScheduleRequest.title,
        payType: postPlanScheduleRequest.payType,
        amount: postPlanScheduleRequest.amount,
        startDate: postPlanScheduleRequest.startDate
          ? new Date(postPlanScheduleRequest.startDate)
          : null,
        startTime: postPlanScheduleRequest.startTime || null,
        location: postPlanScheduleRequest.location,
        locationLat: postPlanScheduleRequest.locationLat,
        locationLng: postPlanScheduleRequest.locationLng,
        memo: postPlanScheduleRequest.memo,
      }),
    );

    if (postPlanScheduleRequest.addCategoryNameList) {
      await this.planCategoryRepositoryService.bulkInsert(
        postPlanScheduleRequest.addCategoryNameList.map((name) =>
          plainToInstance(PlanUserCategoryEntity, {
            planUserId: id,
            name,
            planUserRoomId: postPlanScheduleRequest.roomId,
          }),
        ),
      );
    }

    await this.planActivityService.record({
      type: PlanActivityType.SCHEDULE_CREATED,
      planUserId: id,
      planUserRoomId: postPlanScheduleRequest.roomId,
      targetType: PlanActivityTargetType.SCHEDULE,
      targetId: planSchedule.id,
      targetTitle: planSchedule.title,
      amount: planSchedule.amount,
    });

    return PostPlanScheduleResponse.from(planSchedule);
  }

  async postPlanScheduleNotification(
    planUserId: string,
    chatRoomId: number,
    scheduleId: number,
  ) {
    const chatMessage = await this.chatMessageRepositoryService.create(
      plainToInstance(ChatMessageEntity, {
        chatRoomId,
        planUserId,
        message: {
          scheduleId,
        },
        messageType: ChatMessageType.SCHEDULE,
      }),
    );

    const chatMessageDto = await this.chatMessageRepositoryService.findById(
      chatMessage.id,
    );

    const latestChatMessage =
      await this.chatMessageRepositoryService.findLatestChatMessage(chatRoomId);

    await this.chatMessageRepositoryService.updateChatRoomMember(
      chatRoomId,
      planUserId,
      latestChatMessage?.id || 0,
    );

    this.planNotificationService.emitMessage(
      PlanNotificationMessageDto.from(chatRoomId, chatMessageDto),
    );
  }

  async getPlanScheduleList(
    planUserId: string,
    request: GetPlanScheduleListRequest,
  ): Promise<[GetPlanScheduleResponse[], number]> {
    const [planScheduleEntities, total] =
      await this.planScheduleRepositoryService.getList(
        request.page,
        request.count,
        planUserId,
        request.categoryName,
        request.status,
        request.search,
        request.sortColumn,
        request.sort,
      );

    return [
      planScheduleEntities.map((entity) =>
        GetPlanScheduleResponse.from(entity),
      ),
      total,
    ];
  }

  async getPlanScheduleRoomPlanListByRoomId(
    roomId: number,
    request: GetPlanScheduleListRequest,
  ): Promise<[GetPlanScheduleResponse[], number]> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.getByRoomId(roomId);

    const [planScheduleEntities, total] =
      await this.planScheduleRepositoryService.getList(
        request.page,
        request.count,
        undefined,
        request.categoryName,
        request.status,
        request.search,
        request.sortColumn,
        request.sort,
        planUserRoom.id,
      );

    return [
      planScheduleEntities.map((entity) =>
        GetPlanScheduleResponse.from(entity),
      ),
      total,
    ];
  }

  /**
   * 요청자가 해당 스케줄에 접근할 수 있는지 확인한다.
   *
   * 이 검사가 없으면 로그인한 사용자가 스케줄 ID(순차 증가)만 바꿔가며
   * 다른 사용자의 스케줄을 조회·수정·삭제할 수 있다.
   *
   * - 본인이 만든 스케줄이면 허용
   * - 방에 속한 스케줄이면 그 방의 멤버여야 하고,
   *   쓰기 작업(수정·삭제·상태변경)은 READ 권한이면 거부
   */
  private async getAuthorizedPlanSchedule(
    id: number,
    planUserId: string,
    requireWrite: boolean,
  ) {
    const planSchedule = await this.planScheduleRepositoryService.getById(id);

    if (planSchedule.planUserId === planUserId) {
      return planSchedule;
    }

    if (!planSchedule.planUserRoomId) {
      throw new ServiceError(
        'You are not allowed to access this plan schedule',
        ServiceErrorCode.FORBIDDEN,
      );
    }

    const planUserRoomMember =
      await this.planUserRoomMemberRepositoryService.findByRoomIdAndPlanUserId(
        planSchedule.planUserRoomId,
        planUserId,
      );

    if (!planUserRoomMember) {
      throw new ServiceError(
        'You are not a member of this room',
        ServiceErrorCode.FORBIDDEN,
      );
    }

    if (
      requireWrite &&
      planUserRoomMember.permission === PlanUserRoomMemberPermission.READ
    ) {
      throw new ServiceError(
        'You are not allowed to modify this plan schedule',
        ServiceErrorCode.FORBIDDEN,
      );
    }

    return planSchedule;
  }

  async deletePlanSchedule(id: number, planUserId: string) {
    const planSchedule = await this.getAuthorizedPlanSchedule(
      id,
      planUserId,
      true,
    );

    const updateDto: UpdatePlanScheduleDto = {
      id: planSchedule.id,
      status: PlanScheduleStatus.DELETE,
    };

    await this.planScheduleRepositoryService.update(updateDto);

    await this.planActivityService.record({
      type: PlanActivityType.SCHEDULE_DELETED,
      planUserId,
      planUserRoomId: planSchedule.planUserRoomId,
      targetType: PlanActivityTargetType.SCHEDULE,
      targetId: planSchedule.id,
      targetTitle: planSchedule.title,
      amount: planSchedule.amount,
    });
  }

  async getPlanScheduleDetail(
    id: number,
    planUserId: string,
  ): Promise<GetPlanScheduleDetailResponse> {
    const planSchedule = await this.getAuthorizedPlanSchedule(
      id,
      planUserId,
      false,
    );

    return GetPlanScheduleDetailResponse.from(planSchedule);
  }

  @Transactional()
  async patchPlanSchedule(
    id: number,
    body: PatchPlanScheduleRequest,
    planUserId: string,
  ): Promise<PatchPlanScheduleResponse> {
    const planSchedule = await this.getAuthorizedPlanSchedule(
      id,
      planUserId,
      true,
    );

    const updateDto: UpdatePlanScheduleDto = {
      id: planSchedule.id,
      categoryName: body.categoryName,
      title: body.title,
      payType: body.payType,
      amount: body.amount,
      // 보내지 않은 필드는 건드리지 않는다. save() 는 undefined 는 무시하지만
      // null 은 그대로 써 버려서, 예전처럼 무조건 null 을 넣으면 날짜만 빼고
      // PATCH 할 때(보드 드래그 등) 다른 화면의 값이 조용히 지워진다.
      startDate:
        body.startDate === undefined
          ? undefined
          : body.startDate
            ? new Date(body.startDate)
            : null,
      startTime:
        body.startTime === undefined ? undefined : body.startTime || null,
      location: body.location,
      locationLat: body.locationLat,
      locationLng: body.locationLng,
      memo: body.memo,
    };

    await this.planScheduleRepositoryService.update(updateDto);

    if (body.addCategoryNameList) {
      for (const name of body.addCategoryNameList) {
        const existingCategory =
          await this.planCategoryRepositoryService.findByPlanUserIdAndName(
            planSchedule.planUser.id,
            name,
          );
        if (existingCategory) {
          continue;
        }

        await this.planCategoryRepositoryService.save(
          plainToInstance(PlanUserCategoryEntity, {
            planUserId: planSchedule.planUser.id,
            name,
          }),
        );
      }
    }

    return PatchPlanScheduleResponse.from(planSchedule);
  }

  async patchPlanScheduleStatus(
    id: number,
    status: PlanScheduleStatus,
    planUserId: string,
  ): Promise<PatchPlanScheduleStatusResponse> {
    const planSchedule = await this.getAuthorizedPlanSchedule(
      id,
      planUserId,
      true,
    );

    const updateDto: UpdatePlanScheduleDto = {
      id: planSchedule.id,
      status,
    };

    const updatedPlanSchedule =
      await this.planScheduleRepositoryService.update(updateDto);

    if (status === PlanScheduleStatus.COMPLETED) {
      await this.planActivityService.record({
        type: PlanActivityType.SCHEDULE_COMPLETED,
        planUserId,
        planUserRoomId: planSchedule.planUserRoomId,
        targetType: PlanActivityTargetType.SCHEDULE,
        targetId: planSchedule.id,
        targetTitle: planSchedule.title,
        amount: planSchedule.amount,
      });
    }

    return PatchPlanScheduleStatusResponse.from(updatedPlanSchedule);
  }

  async getCalendarList(
    planUserId: string,
    month: number,
    year: number,
    roomId?: number,
  ): Promise<GetCalendarListResponse[]> {
    if (roomId) {
      await this.planUserRoomRepositoryService.getByRoomId(roomId);
    }

    const planSchedules =
      await this.planScheduleRepositoryService.getCalendarList(
        planUserId,
        month,
        year,
        roomId,
      );

    const dayMap = new Map<string, GetCalendarDayItem[]>();

    for (const schedule of planSchedules) {
      if (!schedule.startDate) continue;

      const d = new Date(schedule.startDate);
      const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const existing = dayMap.get(dayStr) ?? [];
      // status를 함께 내려줘야 달력에서 완료된 일정을 구분해 표시할 수 있다
      existing.push({
        id: schedule.id,
        title: schedule.title,
        status: schedule.status,
        categoryName: schedule.categoryName,
        amount: schedule.amount ?? null,
        startTime: schedule.startTime ?? null,
      });
      dayMap.set(dayStr, existing);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const result: GetCalendarListResponse[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const list = dayMap.get(dayStr) ?? [];
      if (list.length > 0) {
        result.push({ day: dayStr, list });
      }
    }

    return result.sort((a, b) => a.day.localeCompare(b.day));
  }
}

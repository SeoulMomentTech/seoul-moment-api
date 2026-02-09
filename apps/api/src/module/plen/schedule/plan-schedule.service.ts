/* eslint-disable max-lines-per-function */
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { UpdatePlanScheduleDto } from '@app/repository/dto/plan-schedule.dto';
import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import { PlanUserCategoryEntity } from '@app/repository/entity/plan-user-category.entity';
import { PlanScheduleStatus } from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { PlanCategoryRepositoryService } from '@app/repository/service/plan-category.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetPlanScheduleDetailResponse,
  GetPlanScheduleListRequest,
  GetPlanScheduleResponse,
  PatchPlanScheduleRequest,
  PatchPlanScheduleResponse,
  PatchPlanScheduleStatusResponse,
  PostPlanScheduleRequest,
  PostPlanScheduleResponse,
} from './plan-schedule.dto';

@Injectable()
export class PlanScheduleService {
  constructor(
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planCategoryRepositoryService: PlanCategoryRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
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
          }),
        ),
      );
    }

    return PostPlanScheduleResponse.from(planSchedule);
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

  async deletePlanSchedule(id: number) {
    const planSchedule = await this.planScheduleRepositoryService.getById(id);

    const updateDto: UpdatePlanScheduleDto = {
      id: planSchedule.id,
      status: PlanScheduleStatus.DELETE,
    };

    await this.planScheduleRepositoryService.update(updateDto);
  }

  async getPlanScheduleDetail(
    id: number,
  ): Promise<GetPlanScheduleDetailResponse> {
    const planSchedule = await this.planScheduleRepositoryService.getById(id);

    return GetPlanScheduleDetailResponse.from(planSchedule);
  }

  @Transactional()
  async patchPlanSchedule(
    id: number,
    body: PatchPlanScheduleRequest,
  ): Promise<PatchPlanScheduleResponse> {
    const planSchedule = await this.planScheduleRepositoryService.getById(id);

    const updateDto: UpdatePlanScheduleDto = {
      id: planSchedule.id,
      categoryName: body.categoryName,
      title: body.title,
      payType: body.payType,
      amount: body.amount,
      startDate: body.startDate ? new Date(body.startDate) : null,
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
  ): Promise<PatchPlanScheduleStatusResponse> {
    const planSchedule = await this.planScheduleRepositoryService.getById(id);

    const updateDto: UpdatePlanScheduleDto = {
      id: planSchedule.id,
      status,
    };

    const updatedPlanSchedule =
      await this.planScheduleRepositoryService.update(updateDto);

    return PatchPlanScheduleStatusResponse.from(updatedPlanSchedule);
  }
}

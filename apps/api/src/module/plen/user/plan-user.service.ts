import { PlanUserRoomMemberEntity } from '@app/repository/entity/plan-user-room-member.entity';
import { PlanUserRoomEntity } from '@app/repository/entity/plan-user-room.entity';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetPlanUserAmountCategory,
  GetPlanUserAmountResponse,
  GetPlanUserResponse,
  GetPlanUserRoomMemberResponse,
  GetPlanUserRoomResponse,
  PatchPlanUserRequest,
  PatchPlanUserResponse,
  PostPlanUserRoomResponse,
} from './plan-user.dto';

@Injectable()
export class PlanUserService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
  ) {}

  async patchPlanUser(
    id: string,
    patchPlanUserRequest: PatchPlanUserRequest,
  ): Promise<PatchPlanUserResponse> {
    const planUser = await this.planUserRepositoryService.getById(id);

    planUser.weddingDate = new Date(patchPlanUserRequest.weddingDate);
    planUser.budget = patchPlanUserRequest.budget;
    planUser.name = patchPlanUserRequest.name;

    await this.planUserRepositoryService.update(planUser);

    return PatchPlanUserResponse.from(planUser);
  }

  async getPlanUserTotalAmount(id: string): Promise<number> {
    const totalAmount =
      await this.planScheduleRepositoryService.getPlanAmount(id);

    return totalAmount;
  }

  async getPlanUserAmount(id: string): Promise<GetPlanUserAmountResponse> {
    const user = await this.planUserRepositoryService.getById(id);
    const plannedUseAmount =
      await this.planScheduleRepositoryService.getPlannedUseAmount(id);
    const usedAmount =
      await this.planScheduleRepositoryService.getUsedAmount(id);

    return GetPlanUserAmountResponse.from(
      user.budget,
      plannedUseAmount,
      usedAmount,
    );
  }

  async getPlanUserCategoryChartList(
    id: string,
    categoryName: string,
  ): Promise<GetPlanUserAmountCategory[]> {
    const categoryChartList =
      await this.planScheduleRepositoryService.getCategoryChartList(
        id,
        categoryName,
      );

    return categoryChartList.map((v) =>
      GetPlanUserAmountCategory.from(
        v.categoryName,
        v.totalAmount,
        v.usedAmount,
      ),
    );
  }

  @Transactional()
  async postPlanUserRoom(id: string): Promise<PostPlanUserRoomResponse> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.findByOwnerId(id);

    if (planUserRoom) {
      return PostPlanUserRoomResponse.from(planUserRoom);
    }

    const createPlanUserRoom =
      await this.planUserRoomRepositoryService.create(id);

    await this.createIfNotExistsPlanUserRoomMember(
      createPlanUserRoom,
      id,
      PlanUserRoomMemberPermission.OWNER,
    );

    await this.planScheduleRepositoryService.updatePlanUserRoomId(
      id,
      createPlanUserRoom.id,
    );

    return PostPlanUserRoomResponse.from(createPlanUserRoom);
  }

  async getPlanUserRoom(
    id: string,
    shareCode: string,
  ): Promise<GetPlanUserResponse> {
    let permission: PlanUserRoomMemberPermission =
      PlanUserRoomMemberPermission.READ;

    let planUserRoom =
      await this.planUserRoomRepositoryService.findByReadShareCode(shareCode);

    if (!planUserRoom) {
      planUserRoom =
        await this.planUserRoomRepositoryService.getByWriteShareCode(shareCode);
      permission = PlanUserRoomMemberPermission.WRITE;
    }

    const userEntity = await this.planUserRepositoryService.getById(
      planUserRoom.ownerId,
    );

    await this.createIfNotExistsPlanUserRoomMember(
      planUserRoom,
      id,
      permission,
    );

    const roomMemberList = await this.getPlanUserRoomMemberListByUserId(
      planUserRoom.ownerId,
    );

    return GetPlanUserResponse.from(userEntity, roomMemberList);
  }

  async getPlanUserRoomByRoomId(
    id: string,
    roomId: number,
  ): Promise<GetPlanUserResponse> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.getByRoomId(roomId);

    const userEntity = await this.planUserRepositoryService.getById(
      planUserRoom.ownerId,
    );

    const roomMemberList = await this.getPlanUserRoomMemberListByUserId(
      planUserRoom.ownerId,
    );

    return GetPlanUserResponse.from(userEntity, roomMemberList);
  }

  private async createIfNotExistsPlanUserRoomMember(
    planUserRoom: PlanUserRoomEntity,
    planUserId: string,
    permission: PlanUserRoomMemberPermission,
  ) {
    const planUserRoomMember =
      await this.planUserRoomMemberRepositoryService.findByRoomIdAndPlanUserId(
        planUserRoom.id,
        planUserId,
      );

    if (!planUserRoomMember) {
      await this.planUserRoomMemberRepositoryService.create(
        plainToInstance(PlanUserRoomMemberEntity, {
          roomId: planUserRoom.id,
          planUserId,
          permission,
        }),
      );
    }
  }

  async getPlanUserRoomMemberList(
    shareCode: string,
  ): Promise<GetPlanUserRoomMemberResponse[]> {
    let planUserRoom =
      await this.planUserRoomRepositoryService.findByReadShareCode(shareCode);

    if (!planUserRoom) {
      planUserRoom =
        await this.planUserRoomRepositoryService.getByWriteShareCode(shareCode);
    }

    const planUserRoomMemberList =
      await this.planUserRoomMemberRepositoryService.getByRoomId(
        planUserRoom.id,
      );

    return planUserRoomMemberList.map((v) =>
      GetPlanUserRoomMemberResponse.from(v.planUser),
    );
  }

  async getPlanUserRoomMemberListByRoomId(
    roomId: number,
  ): Promise<GetPlanUserRoomMemberResponse[]> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.getByRoomId(roomId);

    const planUserRoomMemberList =
      await this.planUserRoomMemberRepositoryService.getByRoomId(
        planUserRoom.id,
      );

    return planUserRoomMemberList.map((v) =>
      GetPlanUserRoomMemberResponse.from(v.planUser),
    );
  }

  async getPlanUserRoomMemberListByUserId(
    userId: string,
  ): Promise<GetPlanUserRoomMemberResponse[]> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.findByOwnerId(userId);

    if (!planUserRoom) {
      return [];
    }

    const planUserRoomMemberList =
      await this.planUserRoomMemberRepositoryService.getByRoomId(
        planUserRoom.id,
      );

    return planUserRoomMemberList.map((v) =>
      GetPlanUserRoomMemberResponse.from(v.planUser),
    );
  }

  async getPlanUserRoomList(id: string): Promise<GetPlanUserRoomResponse[]> {
    const result: GetPlanUserRoomResponse[] = [];

    const planUserRoomMemberEntityList =
      await this.planUserRoomMemberRepositoryService.getByPlanUserIdWithoutOwner(
        id,
      );

    for (const planUserRoomMemberEntity of planUserRoomMemberEntityList) {
      const planUserRoom = planUserRoomMemberEntity.room;

      const planAmount =
        await this.planScheduleRepositoryService.getPlanAmountByRoomId(
          planUserRoom.id,
        );

      const remainingBudget = planUserRoom.owner.budget - planAmount;

      const memberDtoList = await this.getPlanUserRoomMemberListByRoomId(
        planUserRoom.id,
      );

      result.push(
        GetPlanUserRoomResponse.from(
          planUserRoom,
          remainingBudget,
          memberDtoList,
        ),
      );
    }

    return result;
  }
}

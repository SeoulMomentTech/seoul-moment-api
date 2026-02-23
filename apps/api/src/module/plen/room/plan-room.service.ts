/* eslint-disable max-lines-per-function */
import { ChatRoomMemberEntity } from '@app/repository/entity/chat-room-member.entity';
import { ChatRoomEntity } from '@app/repository/entity/chat-room.entity';
import { PlanUserRoomMemberEntity } from '@app/repository/entity/plan-user-room-member.entity';
import { PlanUserRoomEntity } from '@app/repository/entity/plan-user-room.entity';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { ChatMessageRepositoryService } from '@app/repository/service/chat-message.repository.service';
import { PlanCategoryRepositoryService } from '@app/repository/service/plan-category.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetPlanRoomListResponse,
  GetPlanRoomMemberResponse,
  GetPlanRoomResponse,
} from './plan-room.dto';
import { GetPlanUserTotalAmountResponse } from '../schedule/plan-schedule.dto';
import {
  GetPlanUserAmountCategory,
  GetPlanUserAmountResponse,
} from '../user/plan-user.dto';

@Injectable()
export class PlanRoomService {
  constructor(
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planCategoryRepositoryService: PlanCategoryRepositoryService,
    private readonly chatMessageRepositoryService: ChatMessageRepositoryService,
  ) {}

  async getPlanRoomInfo(roomId: number): Promise<GetPlanRoomResponse> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.getByRoomId(roomId);

    const userEntity = await this.planUserRepositoryService.getById(
      planUserRoom.ownerId,
    );

    const roomMemberList = await this.getPlanUserRoomMemberListByUserId(
      planUserRoom.ownerId,
    );

    return GetPlanRoomResponse.from(userEntity, roomMemberList);
  }

  async getPlanRoomAmount(roomId: number): Promise<GetPlanUserAmountResponse> {
    const planUserRoomEntity =
      await this.planUserRoomRepositoryService.getByRoomId(roomId);

    const plannedUseAmount =
      await this.planScheduleRepositoryService.getPlannedUseAmountByRoomId(
        roomId,
      );
    const usedAmount =
      await this.planScheduleRepositoryService.getUsedAmountByRoomId(roomId);

    return GetPlanUserAmountResponse.from(
      planUserRoomEntity.owner.budget,
      plannedUseAmount,
      usedAmount,
    );
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

  private async createIfNotExistsPlanUserRoom(ownerId: string) {
    const planUserRoom =
      await this.planUserRoomRepositoryService.findByOwnerId(ownerId);

    if (planUserRoom) {
      return planUserRoom;
    }

    return this.planUserRoomRepositoryService.create(ownerId);
  }

  @Transactional()
  async postPlanRoom(userId: string, shareCode: string) {
    const ownerUserEntity =
      await this.planUserRepositoryService.getByRoomShareCode(shareCode);

    const createPlanUserRoom = await this.createIfNotExistsPlanUserRoom(
      ownerUserEntity.id,
    );

    await this.createIfNotExistsPlanUserRoomMember(
      createPlanUserRoom,
      ownerUserEntity.id,
      PlanUserRoomMemberPermission.OWNER,
    );

    await this.createIfNotExistsPlanUserRoomMember(
      createPlanUserRoom,
      userId,
      PlanUserRoomMemberPermission.WRITE,
    );

    await this.planScheduleRepositoryService.updatePlanUserRoomId(
      ownerUserEntity.id,
      createPlanUserRoom.id,
    );

    await this.planCategoryRepositoryService.updatePlanUserRoomId(
      ownerUserEntity.id,
      createPlanUserRoom.id,
    );

    const chatRoomEntity =
      await this.chatMessageRepositoryService.createChatRoom(
        plainToInstance(ChatRoomEntity, {
          planUserRoomId: createPlanUserRoom.id,
        }),
      );

    await Promise.all([
      this.chatMessageRepositoryService.createChatRoomMember(
        plainToInstance(ChatRoomMemberEntity, {
          chatRoomId: chatRoomEntity.id,
          planUserId: ownerUserEntity.id,
        }),
      ),
      this.chatMessageRepositoryService.createChatRoomMember(
        plainToInstance(ChatRoomMemberEntity, {
          chatRoomId: chatRoomEntity.id,
          planUserId: userId,
        }),
      ),
    ]);
  }

  private async getPlanUserRoomMemberListByUserId(
    userId: string,
  ): Promise<GetPlanRoomMemberResponse[]> {
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
      GetPlanRoomMemberResponse.from(v.planUser),
    );
  }

  private async getPlanUserRoomMemberListByRoomId(
    roomId: number,
  ): Promise<GetPlanRoomMemberResponse[]> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.getByRoomId(roomId);

    const planUserRoomMemberList =
      await this.planUserRoomMemberRepositoryService.getByRoomId(
        planUserRoom.id,
      );

    return planUserRoomMemberList.map((v) =>
      GetPlanRoomMemberResponse.from(v.planUser),
    );
  }

  async getPlanRoomList(id: string): Promise<GetPlanRoomListResponse[]> {
    const result: GetPlanRoomListResponse[] = [];

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
        GetPlanRoomListResponse.from(
          planUserRoom,
          remainingBudget,
          memberDtoList,
        ),
      );
    }

    return result;
  }

  async getPlanRoomTotalAmount(
    roomId: number,
  ): Promise<GetPlanUserTotalAmountResponse> {
    const planUserRoomEntity =
      await this.planUserRoomRepositoryService.getByRoomId(roomId);

    const planAmount =
      await this.planScheduleRepositoryService.getPlanAmountByRoomId(roomId);

    return GetPlanUserTotalAmountResponse.from(
      planUserRoomEntity.owner.budget,
      planAmount,
      planUserRoomEntity.owner.budget - planAmount,
    );
  }

  async getPlanRoomCategoryChartList(
    roomId: number,
    categoryName: string,
  ): Promise<GetPlanUserAmountCategory[]> {
    const categoryChartList =
      await this.planScheduleRepositoryService.getCategoryChartList(
        undefined,
        roomId,
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
}

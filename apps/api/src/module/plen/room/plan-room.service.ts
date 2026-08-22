/* eslint-disable max-lines-per-function */
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ChatRoomMemberEntity } from '@app/repository/entity/chat-room-member.entity';
import { ChatRoomEntity } from '@app/repository/entity/chat-room.entity';
import { PlanUserRoomMemberEntity } from '@app/repository/entity/plan-user-room-member.entity';
import { PlanUserRoomEntity } from '@app/repository/entity/plan-user-room.entity';
import {
  PlanActivityTargetType,
  PlanActivityType,
} from '@app/repository/enum/plan-activity.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { ChatRepositoryService } from '@app/repository/service/chat.repository.service';
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
import { PlanActivityService } from '../activity/plan-activity.service';
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
    private readonly chatMessageRepositoryService: ChatRepositoryService,
    private readonly planActivityService: PlanActivityService,
  ) {}

  /**
   * 요청자가 해당 방의 멤버인지 확인한다.
   *
   * 이 검사가 없으면 로그인한 사용자가 방 ID(순차 증가)만 바꿔가며
   * 다른 사람의 결혼 정보·예산·멤버 목록을 들여다볼 수 있다.
   */
  private async assertRoomMember(
    roomId: number,
    planUserId: string,
  ): Promise<void> {
    const member =
      await this.planUserRoomMemberRepositoryService.findByRoomIdAndPlanUserId(
        roomId,
        planUserId,
      );

    if (!member) {
      throw new ServiceError(
        'You are not a member of this room',
        ServiceErrorCode.FORBIDDEN,
      );
    }
  }

  async getPlanRoomInfo(
    roomId: number,
    planUserId: string,
  ): Promise<GetPlanRoomResponse> {
    await this.assertRoomMember(roomId, planUserId);

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

  async getPlanRoomAmount(
    roomId: number,
    planUserId: string,
  ): Promise<GetPlanUserAmountResponse> {
    await this.assertRoomMember(roomId, planUserId);

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

    if (userId === ownerUserEntity.id) {
      return;
    }

    const planUserRoom = await this.createIfNotExistsPlanUserRoom(
      ownerUserEntity.id,
    );

    const planUserRoomMember =
      await this.planUserRoomMemberRepositoryService.findByRoomIdAndPlanUserId(
        planUserRoom.id,
        userId,
      );

    if (planUserRoomMember) {
      return;
    }

    await this.planUserRoomMemberRepositoryService.create(
      plainToInstance(PlanUserRoomMemberEntity, {
        roomId: planUserRoom.id,
        planUserId: ownerUserEntity.id,
        permission: PlanUserRoomMemberPermission.OWNER,
      }),
    );

    await this.planUserRoomMemberRepositoryService.create(
      plainToInstance(PlanUserRoomMemberEntity, {
        roomId: planUserRoom.id,
        planUserId: userId,
        // 새로 들어오는 사람은 조언자다. 신랑·신부는 방장이 따로 지정한다.
        permission: PlanUserRoomMemberPermission.READ,
      }),
    );

    // 이 지점까지 왔다는 건 방이 이제 막 공유되기 시작했다는 뜻이다
    // (이미 멤버였다면 위에서 반환했다).
    await this.planActivityService.record({
      type: PlanActivityType.ROOM_CREATED,
      planUserId: ownerUserEntity.id,
      planUserRoomId: planUserRoom.id,
      targetType: PlanActivityTargetType.ROOM,
      targetId: planUserRoom.id,
    });

    await this.planActivityService.record({
      type: PlanActivityType.MEMBER_JOINED,
      planUserId: userId,
      planUserRoomId: planUserRoom.id,
      targetType: PlanActivityTargetType.ROOM,
      targetId: planUserRoom.id,
    });

    await this.planScheduleRepositoryService.updatePlanUserRoomId(
      ownerUserEntity.id,
      planUserRoom.id,
    );

    await this.planCategoryRepositoryService.updatePlanUserRoomId(
      ownerUserEntity.id,
      planUserRoom.id,
    );

    const chatRoomEntity =
      await this.chatMessageRepositoryService.createChatRoom(
        plainToInstance(ChatRoomEntity, {
          planUserRoomId: planUserRoom.id,
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

  /** 방장 본인인지. 배우자 지정처럼 방장만 할 수 있는 일에 쓴다 */
  private async assertRoomOwner(
    roomId: number,
    planUserId: string,
  ): Promise<void> {
    const member =
      await this.planUserRoomMemberRepositoryService.findByRoomIdAndPlanUserId(
        roomId,
        planUserId,
      );

    if (member?.permission !== PlanUserRoomMemberPermission.OWNER) {
      throw new ServiceError(
        'Only the room owner can change the spouse',
        ServiceErrorCode.FORBIDDEN,
      );
    }
  }

  /**
   * 신랑·신부(배우자) 지정. 방마다 한 명뿐이라 기존 배우자는 조언자로
   * 내린다. planUserId 가 없으면 지정을 푼다.
   */
  @Transactional()
  async patchPlanRoomSpouse(
    ownerId: string,
    planUserId: string | null,
  ): Promise<void> {
    const room =
      await this.planUserRoomRepositoryService.findByOwnerId(ownerId);

    if (!room) {
      throw new ServiceError(
        'You do not have a plan room',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    await this.assertRoomOwner(room.id, ownerId);

    if (planUserId && planUserId === ownerId) {
      throw new ServiceError(
        'You cannot set yourself as the spouse',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    const current =
      await this.planUserRoomMemberRepositoryService.findSpouseByRoomId(
        room.id,
      );

    // 먼저 내려놓지 않으면 부분 유니크 인덱스에 걸린다
    if (current && current.planUserId !== planUserId) {
      current.permission = PlanUserRoomMemberPermission.READ;
      await this.planUserRoomMemberRepositoryService.save(current);
    }

    if (!planUserId) {
      if (current) {
        await this.planActivityService.record({
          type: PlanActivityType.SPOUSE_CLEARED,
          planUserId: ownerId,
          planUserRoomId: room.id,
          targetType: PlanActivityTargetType.ROOM,
          targetId: room.id,
        });
      }
      return;
    }

    const target =
      await this.planUserRoomMemberRepositoryService.findByRoomIdAndPlanUserId(
        room.id,
        planUserId,
      );

    if (!target) {
      throw new ServiceError(
        'That user is not a member of this room',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    if (target.permission === PlanUserRoomMemberPermission.SPOUSE) return;

    target.permission = PlanUserRoomMemberPermission.SPOUSE;
    await this.planUserRoomMemberRepositoryService.save(target);

    await this.planActivityService.record({
      type: PlanActivityType.SPOUSE_ASSIGNED,
      planUserId: ownerId,
      planUserRoomId: room.id,
      targetType: PlanActivityTargetType.ROOM,
      targetId: room.id,
    });
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

      // 아직 안 쓴 예정 지출. 카드 막대에서 실제 지출 뒤에 회색으로 붙는다.
      const plannedUseAmount =
        await this.planScheduleRepositoryService.getPlannedUseAmountByRoomId(
          planUserRoom.id,
        );

      const memberDtoList = await this.getPlanUserRoomMemberListByRoomId(
        planUserRoom.id,
      );

      const coupleIds =
        await this.planUserRoomMemberRepositoryService.findCoupleIdsByRoomIds([
          planUserRoom.id,
        ]);

      result.push(
        GetPlanRoomListResponse.from(
          planUserRoom,
          remainingBudget,
          memberDtoList,
          plannedUseAmount,
          coupleIds.get(planUserRoom.id),
        ),
      );
    }

    return result;
  }

  async getPlanRoomTotalAmount(
    roomId: number,
    planUserId: string,
  ): Promise<GetPlanUserTotalAmountResponse> {
    await this.assertRoomMember(roomId, planUserId);

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
    planUserId: string,
  ): Promise<GetPlanUserAmountCategory[]> {
    await this.assertRoomMember(roomId, planUserId);

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

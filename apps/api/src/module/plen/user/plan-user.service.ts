import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { ChatRepositoryService } from '@app/repository/service/chat.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { PlanUserDeviceTokenRepositoryService } from '@app/repository/service/plan-user-device-token.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import {
  DeletePlanUserDeviceTokenRequest,
  GetPlanUserAmountCategory,
  GetPlanUserAmountResponse,
  GetPlanUserRoomMemberResponse,
  GetUserChatRoomResponse,
  PatchPlanUserRequest,
  PatchPlanUserResponse,
  PostPlanUserDeviceTokenRequest,
} from './plan-user.dto';
import { GetPlanUserTotalAmountResponse } from '../schedule/plan-schedule.dto';

@Injectable()
export class PlanUserService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
    private readonly chatRoomRepositoryService: ChatRepositoryService,
    private readonly planUserDeviceTokenRepositoryService: PlanUserDeviceTokenRepositoryService,
  ) {}

  /**
   * FCM 기기 토큰 등록. 앱은 토큰이 바뀔 때마다·로그인 직후마다 부르므로
   * 같은 토큰이 반복해서 들어온다 — 새로 쌓지 않고 upsert 한다.
   */
  async postPlanUserDeviceToken(
    planUserId: string,
    request: PostPlanUserDeviceTokenRequest,
  ): Promise<void> {
    await this.planUserDeviceTokenRepositoryService.upsert(
      planUserId,
      request.token,
      request.platform,
    );
  }

  /**
   * 로그아웃한 기기를 발송 대상에서 뺀다.
   *
   * 없는 토큰이어도 성공으로 둔다 — 로그아웃이 "이미 지워졌다"는 이유로 실패하면
   * 앱은 재시도할 방법이 없고, 결과적으로 남의 기기에 알림이 계속 가는 쪽이 더 나쁘다.
   */
  async deletePlanUserDeviceToken(
    planUserId: string,
    request: DeletePlanUserDeviceTokenRequest,
  ): Promise<void> {
    await this.planUserDeviceTokenRepositoryService.deleteByPlanUserIdAndToken(
      planUserId,
      request.token,
    );
  }

  /**
   * 회원 탈퇴.
   *
   * 앱 심사가 앱 안에서 계정을 지울 수 있기를 요구한다(애플 5.1.1(v),
   * 구글 데이터 삭제 정책). 되돌릴 수 없어서 화면에서 두 번 확인받는다.
   *
   * 기기 토큰을 먼저 지운다 — 탈퇴 처리 도중 들어온 채팅 푸시가 이미 나간
   * 사람의 기기로 가면 안 된다.
   */
  @Transactional()
  async deletePlanUser(planUserId: string): Promise<void> {
    await this.planUserDeviceTokenRepositoryService.deleteAllByPlanUserId(
      planUserId,
    );

    await this.planUserRepositoryService.withdraw(planUserId);
  }

  async patchPlanUser(
    id: string,
    patchPlanUserRequest: PatchPlanUserRequest,
  ): Promise<PatchPlanUserResponse> {
    const planUser = await this.planUserRepositoryService.getById(id);

    planUser.weddingDate = new Date(patchPlanUserRequest.weddingDate);
    planUser.budget = patchPlanUserRequest.budget;
    planUser.name = patchPlanUserRequest.name;
    planUser.requiredAgreementDate = new Date(
      patchPlanUserRequest.requiredAgreementDate,
    );
    planUser.adAgreementDate = new Date(patchPlanUserRequest.adAgreementDate);

    await this.planUserRepositoryService.update(planUser);

    return PatchPlanUserResponse.from(planUser);
  }

  async getPlanUserTotalAmount(
    id: string,
    budget: number,
  ): Promise<GetPlanUserTotalAmountResponse> {
    /*
      방 id 를 주지 않는다 — 그러면 "개인 일정 + 내가 방장인 방의 일정" 둘 다
      센다. 예전에는 내 방만 세어서, /add-plen 에서 방 없이 만든 일정이
      목록에는 보이는데 예산에서는 통째로 빠졌다.
    */
    const planAmount =
      await this.planScheduleRepositoryService.getPlanAmount(id);

    return GetPlanUserTotalAmountResponse.from(
      budget,
      planAmount,
      budget - planAmount,
    );
  }

  async getPlanUserAmount(
    userEntity: PlanUserEntity,
  ): Promise<GetPlanUserAmountResponse> {
    // 위와 같은 이유로 방 id 를 주지 않는다 (개인 + 내 방 둘 다)
    const plannedUseAmount =
      await this.planScheduleRepositoryService.getPlannedUseAmount(
        userEntity.id,
      );
    const usedAmount = await this.planScheduleRepositoryService.getUsedAmount(
      userEntity.id,
    );

    return GetPlanUserAmountResponse.from(
      userEntity.budget,
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
        undefined,
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

  async postHasSeenMainGuide(id: string): Promise<void> {
    const planUser = await this.planUserRepositoryService.getById(id);
    planUser.hasSeenMainGuideDate = new Date();
    await this.planUserRepositoryService.update(planUser);
  }

  async postHasSeenBudgetGuide(id: string): Promise<void> {
    const planUser = await this.planUserRepositoryService.getById(id);
    planUser.hasSeenBudgetGuideDate = new Date();
    await this.planUserRepositoryService.update(planUser);
  }

  async postHasSeenChatGuide(id: string): Promise<void> {
    const planUser = await this.planUserRepositoryService.getById(id);
    planUser.hasSeenChatGuideDate = new Date();
    await this.planUserRepositoryService.update(planUser);
  }

  async getUserChatRoomList(id: string): Promise<GetUserChatRoomResponse[]> {
    const chatRoomList =
      await this.chatRoomRepositoryService.findChatRoomByPlanUserId(id);

    const [lastMessages, coupleIdsByPlanRoom] = await Promise.all([
      this.chatRoomRepositoryService.findLastMessageByRoomIds(
        chatRoomList.map((v) => v.id),
      ),
      // 채팅방은 여러 플랜 방에 걸쳐 있을 수 있다. 방마다 신랑·신부 두
      // 사람을 받아 두고 멤버 구성으로 커플 방을 가린다.
      this.planUserRoomMemberRepositoryService.findCoupleIdsByRoomIds([
        ...new Set(chatRoomList.map((v) => v.planUserRoomId)),
      ]),
    ]);

    return chatRoomList.map((v) =>
      GetUserChatRoomResponse.from(
        v,
        lastMessages.get(v.id) ?? null,
        coupleIdsByPlanRoom.get(v.planUserRoomId),
      ),
    );
  }
}

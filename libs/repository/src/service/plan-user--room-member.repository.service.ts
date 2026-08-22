import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PlanUserRoomMemberEntity } from '../entity/plan-user-room-member.entity';
import { PlanUserRoomMemberPermission } from '../enum/plan-user-room-member.enum';

@Injectable()
export class PlanUserRoomMemberRepositoryService {
  constructor(
    @InjectRepository(PlanUserRoomMemberEntity)
    private readonly planUserRoomMemberRepository: Repository<PlanUserRoomMemberEntity>,
  ) {}

  async create(
    entity: PlanUserRoomMemberEntity,
  ): Promise<PlanUserRoomMemberEntity> {
    return this.planUserRoomMemberRepository.save(entity);
  }

  async save(
    entity: PlanUserRoomMemberEntity,
  ): Promise<PlanUserRoomMemberEntity> {
    return this.planUserRoomMemberRepository.save(entity);
  }

  /**
   * 플랜 방마다 "신랑·신부 두 사람"의 id. 배우자가 지정돼 있을 때만 값이
   * 있다. 채팅방이 커플 방인지는 별도 컬럼 없이 이걸로 판별한다 —
   * 멤버가 이 두 사람뿐인 채팅방이 곧 신랑·신부 방이다.
   */
  async findCoupleIdsByRoomIds(
    roomIds: number[],
  ): Promise<Map<number, string[]>> {
    if (roomIds.length === 0) return new Map();

    const rows = await this.planUserRoomMemberRepository.find({
      where: {
        roomId: In(roomIds),
        permission: In([
          PlanUserRoomMemberPermission.OWNER,
          PlanUserRoomMemberPermission.SPOUSE,
        ]),
      },
    });

    const byRoom = new Map<number, { owner?: string; spouse?: string }>();
    for (const row of rows) {
      const slot = byRoom.get(row.roomId) ?? {};
      if (row.permission === PlanUserRoomMemberPermission.OWNER) {
        slot.owner = row.planUserId;
      } else {
        slot.spouse = row.planUserId;
      }
      byRoom.set(row.roomId, slot);
    }

    const result = new Map<number, string[]>();
    for (const [roomId, { owner, spouse }] of byRoom) {
      // 배우자가 없으면 커플 방도 없다
      if (owner && spouse) result.set(roomId, [owner, spouse]);
    }
    return result;
  }

  /** 방의 배우자. 없으면 null */
  async findSpouseByRoomId(
    roomId: number,
  ): Promise<PlanUserRoomMemberEntity | null> {
    return this.planUserRoomMemberRepository.findOne({
      where: { roomId, permission: PlanUserRoomMemberPermission.SPOUSE },
    });
  }

  async getByRoomId(roomId: number): Promise<PlanUserRoomMemberEntity[]> {
    return this.planUserRoomMemberRepository.find({
      where: { roomId },
      relations: ['planUser', 'planUser.members'],
    });
  }

  async getByRoomIdAndPlanUserId(
    roomId: number,
    planUserId: string,
  ): Promise<PlanUserRoomMemberEntity> {
    const result = await this.planUserRoomMemberRepository.findOneBy({
      roomId,
      planUserId,
    });

    if (!result) {
      throw new ServiceError(
        'Plan user room member not found roomId: ${roomId}, planUserId: ${planUserId}',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async findByRoomIdAndPlanUserId(
    roomId: number,
    planUserId: string,
  ): Promise<PlanUserRoomMemberEntity | null> {
    return this.planUserRoomMemberRepository.findOneBy({
      roomId,
      planUserId,
    });
  }

  async getByPlanUserIdWithoutOwner(
    planUserId: string,
  ): Promise<PlanUserRoomMemberEntity[]> {
    return this.planUserRoomMemberRepository.find({
      where: { planUserId },
      relations: [
        'room',
        'room.owner',
        'room.schedules',
        'room.chatRooms',
        'room.chatRooms.members',
        'room.chatRooms.members.planUser',
        'room.chatRooms.members.planUser.members',
      ],
    });
  }
}

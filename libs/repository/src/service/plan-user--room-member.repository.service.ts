import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { PlanUserRoomMemberEntity } from '../entity/plan-user-room-member.entity';

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
      where: { planUserId, room: { ownerId: Not(planUserId) } },
      relations: ['room', 'room.owner', 'room.schedules'],
    });
  }
}

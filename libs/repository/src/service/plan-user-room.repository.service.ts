import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanUserRoomEntity } from '../entity/plan-user-room.entity';

@Injectable()
export class PlanUserRoomRepositoryService {
  constructor(
    @InjectRepository(PlanUserRoomEntity)
    private readonly planUserRoomRepository: Repository<PlanUserRoomEntity>,
  ) {}

  async create(ownerId: string): Promise<PlanUserRoomEntity> {
    const planUserRoom = this.planUserRoomRepository.create({
      ownerId,
    });

    return this.planUserRoomRepository.save(planUserRoom);
  }

  async getByOwnerId(ownerId: string): Promise<PlanUserRoomEntity> {
    const result = await this.planUserRoomRepository.findOneBy({ ownerId });

    if (!result) {
      throw new ServiceError(
        `Plan user room not found ownerId: ${ownerId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async isExistOwnerId(ownerId: string): Promise<boolean> {
    const result = await this.planUserRoomRepository.exists({
      where: { ownerId },
    });

    return result;
  }

  async findByOwnerId(ownerId: string): Promise<PlanUserRoomEntity | null> {
    return this.planUserRoomRepository.findOneBy({ ownerId });
  }

  async getByRoomId(id: number): Promise<PlanUserRoomEntity> {
    const result = await this.planUserRoomRepository.findOneBy({ id });

    if (!result) {
      throw new ServiceError(
        `Plan user room not found roomId: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }
    return this.planUserRoomRepository.findOneBy({ id });
  }
}

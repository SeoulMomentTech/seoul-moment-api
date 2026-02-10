import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanUserEntity } from '../entity/plan-user.entity';
import { PlatformType } from '../enum/plan-user.enum';

@Injectable()
export class PlanUserRepositoryService {
  constructor(
    @InjectRepository(PlanUserEntity)
    private readonly planUserRepository: Repository<PlanUserEntity>,
  ) {}

  async create(planUser: PlanUserEntity): Promise<PlanUserEntity> {
    return this.planUserRepository.save(planUser);
  }

  async findByPlatfomeType(
    platformType: PlatformType,
    id: number,
    email?: string,
  ): Promise<PlanUserEntity | null> {
    switch (platformType) {
      case PlatformType.KAKAO:
        return this.planUserRepository.findOneBy({
          kakaoId: id,
          kakaoEmail: email,
        });
      case PlatformType.NAVER:
        return this.planUserRepository.findOneBy({
          naverId: id,
          naverEmail: email,
        });
      case PlatformType.GOOGLE:
        return this.planUserRepository.findOneBy({
          googleId: id,
          googleEmail: email,
        });
    }
  }

  async getByKakaoInfo(kakaoId: number, id: string): Promise<PlanUserEntity> {
    const result = await this.planUserRepository.findOneBy({ kakaoId, id });

    if (!result) {
      throw new ServiceError(
        'Plan user not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async findByKakaoInfo(
    kakaoId: number,
    id: string,
  ): Promise<PlanUserEntity | null> {
    return this.planUserRepository.findOne({
      where: { kakaoId, id },
      relations: ['room'],
    });
  }

  async getById(id: string): Promise<PlanUserEntity> {
    const result = await this.planUserRepository.findOneBy({ id });

    if (!result) {
      throw new ServiceError(
        'Plan user not found id: ${id}',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async getByRoomShareCode(roomShareCode: string): Promise<PlanUserEntity> {
    const result = await this.planUserRepository.findOneBy({ roomShareCode });

    if (!result) {
      throw new ServiceError(
        `Plan user not found roomShareCode: ${roomShareCode}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }
    return result;
  }

  async update(planUser: PlanUserEntity): Promise<PlanUserEntity> {
    return this.planUserRepository.save(planUser);
  }
}

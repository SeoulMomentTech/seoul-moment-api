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
  ): Promise<PlanUserEntity | null> {
    switch (platformType) {
      case PlatformType.KAKAO:
        return this.planUserRepository.findOneBy({ kakaoId: id });
      case PlatformType.NAVER:
        return this.planUserRepository.findOneBy({ naverId: id });
      case PlatformType.GOOGLE:
        return this.planUserRepository.findOneBy({ googleId: id });
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
}

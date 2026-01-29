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
    id: string,
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
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanUserEntity } from '../entity/plan-user.entity';

@Injectable()
export class PlanUserRepositoryService {
  constructor(
    @InjectRepository(PlanUserEntity)
    private readonly planUserRepository: Repository<PlanUserEntity>,
  ) {}

  async create(planUser: PlanUserEntity): Promise<PlanUserEntity> {
    return this.planUserRepository.save(planUser);
  }

  async findByEmail(email: string): Promise<PlanUserEntity | null> {
    return this.planUserRepository.findOneBy({ email });
  }
}

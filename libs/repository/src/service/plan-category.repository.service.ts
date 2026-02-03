import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanAllCategoryDto } from '../dto/plan-category.dto';
import { PlanCategoryEntity } from '../entity/plan-category.entity';
import { PlanUserCategoryEntity } from '../entity/plan-user-category.entity';
import { PlanCategoryType } from '../enum/plan-category.enum';

@Injectable()
export class PlanCategoryRepositoryService {
  constructor(
    @InjectRepository(PlanCategoryEntity)
    private readonly planCategoryRepository: Repository<PlanCategoryEntity>,
    @InjectRepository(PlanUserCategoryEntity)
    private readonly planUserCategoryRepository: Repository<PlanUserCategoryEntity>,
  ) {}

  async findAll(): Promise<PlanAllCategoryDto[]> {
    const [planCategories, planUserCategories] = await Promise.all([
      this.planCategoryRepository.find({ select: ['id', 'name'] }),
      this.planUserCategoryRepository.find({ select: ['id', 'name'] }),
    ]);

    return [
      ...planCategories.map((c) =>
        PlanAllCategoryDto.from(c.id, c.name, PlanCategoryType.SYSTEM),
      ),
      ...planUserCategories.map((c) =>
        PlanAllCategoryDto.from(c.id, c.name, PlanCategoryType.USER),
      ),
    ];
  }

  async bulkInsert(
    entity: PlanUserCategoryEntity[],
  ): Promise<PlanUserCategoryEntity[]> {
    return this.planUserCategoryRepository.save(entity);
  }

  async save(entity: PlanUserCategoryEntity): Promise<PlanUserCategoryEntity> {
    return this.planUserCategoryRepository.save(entity);
  }

  async findByPlanUserIdAndName(
    planUserId: string,
    name: string,
  ): Promise<PlanUserCategoryEntity | null> {
    return this.planUserCategoryRepository.findOne({
      where: { planUserId, name },
    });
  }
}

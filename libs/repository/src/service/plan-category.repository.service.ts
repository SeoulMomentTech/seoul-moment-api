import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';

import { PlanAllCategoryDto } from '../dto/plan-category.dto';
import { PlanCategoryEntity } from '../entity/plan-category.entity';
import { PlanUserCategoryEntity } from '../entity/plan-user-category.entity';
import { PlanCategoryType } from '../enum/plan-category.enum';

@Injectable()
export class PlanCategoryRepositoryService implements OnModuleInit {
  constructor(
    @InjectRepository(PlanCategoryEntity)
    private readonly planCategoryRepository: Repository<PlanCategoryEntity>,
    @InjectRepository(PlanUserCategoryEntity)
    private readonly planUserCategoryRepository: Repository<PlanUserCategoryEntity>,
  ) {}

  async onModuleInit() {
    const count = await this.planCategoryRepository.count();
    if (count === 0) {
      await this.planCategoryRepository.save([
        {
          name: '상견례',
          color: '#FFF5E4',
        },
        {
          name: '스드메',
          color: '#FF9494',
        },
        {
          name: '웨딩홀',
          color: '#562F00',
        },
      ]);
    }
  }

  async findAll(
    userId?: string,
    roomId?: number,
  ): Promise<PlanAllCategoryDto[]> {
    let planUserCategories: PlanUserCategoryEntity[] = [];
    let planRoomCategories: PlanUserCategoryEntity[] = [];

    const userCategoryFindOptions: FindManyOptions<PlanUserCategoryEntity> = {
      select: ['id', 'name'],
    };

    const roomCategoryFindOptions: FindManyOptions<PlanUserCategoryEntity> = {
      select: ['id', 'name'],
    };

    const planCategories = await this.planCategoryRepository.find({
      select: ['id', 'name'],
    });

    if (userId) {
      userCategoryFindOptions.where = { planUserId: userId };
      planUserCategories = await this.planUserCategoryRepository.find(
        userCategoryFindOptions,
      );
    }

    if (roomId) {
      roomCategoryFindOptions.where = { planUserRoomId: roomId };
      planRoomCategories = await this.planUserCategoryRepository.find(
        roomCategoryFindOptions,
      );
    }

    return [
      ...planCategories.map((c) =>
        PlanAllCategoryDto.from(c.id, c.name, PlanCategoryType.SYSTEM),
      ),
      ...planUserCategories.map((c) =>
        PlanAllCategoryDto.from(c.id, c.name, PlanCategoryType.USER),
      ),
      ...planRoomCategories.map((c) =>
        PlanAllCategoryDto.from(c.id, c.name, PlanCategoryType.ROOM),
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

  async updatePlanUserRoomId(planUserId: string, planUserRoomId: number) {
    await this.planUserCategoryRepository.update(
      { planUserId },
      { planUserRoomId },
    );
  }
}

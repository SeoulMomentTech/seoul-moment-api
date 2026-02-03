import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';

import { UpdatePlanScheduleDto } from '../dto/plan-schedule.dto';
import { PlanScheduleEntity } from '../entity/plan-schedule.entity';
import {
  PlanScheduleSortColumn,
  PlanScheduleStatus,
} from '../enum/plan-schedule.enum';

@Injectable()
export class PlanScheduleRepositoryService {
  constructor(
    @InjectRepository(PlanScheduleEntity)
    private readonly planScheduleRepository: Repository<PlanScheduleEntity>,
  ) {}

  async findAll(
    page: number,
    count: number,
    categoryName?: string,
    sortColumn: PlanScheduleSortColumn = PlanScheduleSortColumn.CREATE,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[PlanScheduleEntity[], number]> {
    const findOptions: FindOptionsWhere<PlanScheduleEntity> = {
      status: PlanScheduleStatus.NORMAL,
    };

    if (categoryName) {
      findOptions.categoryName = categoryName;
    }

    return this.planScheduleRepository.findAndCount({
      where: findOptions,
      order: {
        [sortColumn]: sort,
      },
      skip: (page - 1) * count,
      take: count,
    });
  }

  async getById(id: number): Promise<PlanScheduleEntity> {
    const result = await this.planScheduleRepository.findOne({
      where: { id, status: PlanScheduleStatus.NORMAL },
    });

    if (!result) {
      throw new ServiceError(
        'Plan schedule not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async create(entity: PlanScheduleEntity): Promise<PlanScheduleEntity> {
    return this.planScheduleRepository.save(entity);
  }

  async update(updateDto: UpdatePlanScheduleDto): Promise<PlanScheduleEntity> {
    return this.planScheduleRepository.save(updateDto);
  }

  async getList(
    page: number,
    count: number,
    search?: string,
    sortColumn: PlanScheduleSortColumn = PlanScheduleSortColumn.CREATE,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[PlanScheduleEntity[], number]> {
    const findOptions: FindOptionsWhere<PlanScheduleEntity> = {
      status: PlanScheduleStatus.NORMAL,
    };

    if (search) {
      findOptions.title = Like(`%${search}%`);
    }

    return this.planScheduleRepository.findAndCount({
      where: findOptions,
      order: {
        [sortColumn]: sort,
      },
      skip: (page - 1) * count,
      take: count,
    });
  }

  async getTotalAmount(id: string): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: { planUserId: id, status: PlanScheduleStatus.NORMAL },
      select: { amount: true },
    });

    return result.reduce((acc, curr) => acc + (curr.amount ?? 0), 0) ?? 0;
  }
}

import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetPlanUserAmountCategory } from 'apps/api/src/module/plen/user/plan-user.dto';
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  Like,
  Not,
  Repository,
} from 'typeorm';

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
      status: Not(In([PlanScheduleStatus.DELETE])),
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
      where: { id, status: Not(In([PlanScheduleStatus.DELETE])) },
      relations: ['planUser'],
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
    planUserId: string,
    categoryName?: string,
    status?: PlanScheduleStatus,
    search?: string,
    sortColumn: PlanScheduleSortColumn = PlanScheduleSortColumn.CREATE,
    sort: DatabaseSort = DatabaseSort.DESC,
    planUserRoomId?: number,
  ): Promise<[PlanScheduleEntity[], number]> {
    const findOptions: FindOptionsWhere<PlanScheduleEntity> = {
      status: Not(
        In([PlanScheduleStatus.DELETE, PlanScheduleStatus.COMPLETED]),
      ),
    };

    if (search) {
      findOptions.title = Like(`%${search}%`);
    }

    if (status) {
      findOptions.status = status;
    }

    if (categoryName) {
      findOptions.categoryName = categoryName;
    }

    if (planUserId) {
      findOptions.planUserId = planUserId;
    }

    if (planUserRoomId) {
      findOptions.planUserRoomId = planUserRoomId;
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

  async getPlanAmount(id: string, roomId?: number): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: {
        planUserId: id,
        status: Not(In([PlanScheduleStatus.DELETE])),
        planUserRoomId: !roomId ? IsNull() : roomId,
      },
      select: { amount: true },
    });

    return result.reduce((acc, curr) => acc + (curr.amount ?? 0), 0) ?? 0;
  }

  async getPlanAmountByRoomId(roomId: number): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: {
        planUserRoomId: roomId,
        status: Not(In([PlanScheduleStatus.DELETE])),
      },
      select: { amount: true },
    });

    return result.reduce((acc, curr) => acc + (curr.amount ?? 0), 0) ?? 0;
  }

  async getPlannedUseAmount(id: string, roomId?: number): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: {
        planUserId: id,
        status: PlanScheduleStatus.NORMAL,
        planUserRoomId: !roomId ? IsNull() : roomId,
      },
      select: { amount: true },
    });

    return result.reduce((acc, curr) => acc + (curr.amount ?? 0), 0) ?? 0;
  }

  async getPlannedUseAmountByRoomId(roomId: number): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: {
        status: PlanScheduleStatus.NORMAL,
        planUserRoomId: roomId,
      },
      select: { amount: true },
    });

    return result.reduce((acc, curr) => acc + (curr.amount ?? 0), 0) ?? 0;
  }

  async getUsedAmount(id: string, roomId?: number): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: {
        planUserId: id,
        status: PlanScheduleStatus.COMPLETED,
        planUserRoomId: !roomId ? IsNull() : roomId,
      },
      select: { amount: true },
    });

    return result.reduce((acc, curr) => acc + (curr.amount ?? 0), 0) ?? 0;
  }

  async getUsedAmountByRoomId(roomId: number): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: {
        status: PlanScheduleStatus.COMPLETED,
        planUserRoomId: roomId,
      },
      select: { amount: true },
    });

    return result.reduce((acc, curr) => acc + (curr.amount ?? 0), 0) ?? 0;
  }

  async getCategoryChartList(
    id: string,
    categoryName?: string,
  ): Promise<GetPlanUserAmountCategory[]> {
    const query = this.planScheduleRepository
      .createQueryBuilder('ps')
      .select('ps.categoryName', 'categoryName')
      .addSelect(`SUM(ps.amount)`, 'totalAmount')
      .addSelect(
        `SUM(CASE WHEN ps.status = :completedStatus THEN ps.amount ELSE 0 END)`,
        'usedAmount',
      )
      .where('ps.planUserId = :id', { id })
      .andWhere('ps.status IN (:...statusList)', {
        statusList: [PlanScheduleStatus.NORMAL, PlanScheduleStatus.COMPLETED],
      })
      .setParameters({
        normalStatus: PlanScheduleStatus.NORMAL,
        completedStatus: PlanScheduleStatus.COMPLETED,
      })
      .groupBy('ps.categoryName');

    if (categoryName) {
      query.andWhere('ps.categoryName = :categoryName', { categoryName });
    }

    const result = await query.getRawMany<{
      categoryName: string;
      totalAmount: string;
      usedAmount: string;
    }>();

    return result.map((v) =>
      GetPlanUserAmountCategory.from(
        v.categoryName,
        Number(v.totalAmount ?? 0),
        Number(v.usedAmount ?? 0),
      ),
    );
  }

  async updatePlanUserRoomId(planUserId: string, planUserRoomId: number) {
    await this.planScheduleRepository.update(
      { planUserId },
      { planUserRoomId },
    );
  }

  async getCalendarList(
    planUserId: string,
    month: number,
    year: number,
    roomId?: number,
  ): Promise<PlanScheduleEntity[]> {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return this.planScheduleRepository.find({
      where: {
        planUserId,
        status: Not(In([PlanScheduleStatus.DELETE])),
        planUserRoomId: !roomId ? IsNull() : roomId,
        startDate: Between(startDate, endDate),
      },
    });
  }
}

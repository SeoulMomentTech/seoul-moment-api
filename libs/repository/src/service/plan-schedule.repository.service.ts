/* eslint-disable max-lines-per-function */
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

/**
 * "이 사람의 플랜" 의 범위.
 *
 * 방을 주면 그 방만, 안 주면 **개인 일정 + 내가 방장인 방의 일정** 둘 다다.
 * 가입할 때 방이 하나 생기고 앱이 일정을 그 방에 붙이기 때문에, 개인만
 * 보면 사실상 아무것도 안 보인다.
 *
 * 예전에는 목록·캘린더·금액이 각자 다른 규칙을 썼다 —
 *   목록  : 개인 + 내 방  (맞음)
 *   캘린더: 개인만        → 방에 붙은 일정이 달력에서 통째로 사라졌다
 *   금액  : 내 방만       → 개인 일정이 예산에서 통째로 빠졌다
 * 같은 데이터를 화면마다 다르게 세던 것이라 한 곳으로 모은다.
 */
function ownScope(
  base: FindOptionsWhere<PlanScheduleEntity>,
  planUserId: string,
  roomId?: number,
): FindOptionsWhere<PlanScheduleEntity>[] {
  if (roomId) return [{ ...base, planUserId, planUserRoomId: roomId }];
  return [
    { ...base, planUserId, planUserRoomId: IsNull() },
    { ...base, planUserId, planUserRoom: { ownerId: planUserId } },
  ];
}

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

  async findById(id: number): Promise<PlanScheduleEntity | null> {
    return await this.planScheduleRepository.findOne({
      where: { id, status: Not(In([PlanScheduleStatus.DELETE])) },
      relations: ['planUser'],
    });
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
    // status 를 안 주면 "지운 것 빼고 전부" 다. 예전에는 여기서 COMPLETED 도
    // 같이 걸렀는데, 그러면 필터를 안 건 목록이 조용히 완료를 빼먹는다 —
    // 플랜 보드와 홈 대시보드처럼 "쓴 돈까지 포함해 전부" 를 봐야 하는
    // 화면이 완료된 일정을 영영 못 받는다. 완료만 보고 싶으면
    // status=COMPLETED 를, 예정만 보고 싶으면 status=NORMAL 을 준다.
    const baseCondition: FindOptionsWhere<PlanScheduleEntity> = {
      status: Not(In([PlanScheduleStatus.DELETE])),
    };

    if (search) {
      baseCondition.title = Like(`%${search}%`);
    }

    if (status) {
      baseCondition.status = status;
    }

    if (categoryName) {
      baseCondition.categoryName = categoryName;
    }

    if (planUserId) {
      baseCondition.planUserId = planUserId;
    }

    const whereConditions: FindOptionsWhere<PlanScheduleEntity>[] = [];

    if (planUserRoomId) {
      whereConditions.push({
        ...baseCondition,
        planUserRoomId,
      });
    } else {
      whereConditions.push(
        {
          ...baseCondition,
          planUserRoomId: IsNull(),
        },
        {
          ...baseCondition,
          planUserRoom: { ownerId: planUserId },
        },
      );
    }

    return this.planScheduleRepository.findAndCount({
      where: whereConditions,
      order: {
        [sortColumn]: sort,
      },
      skip: (page - 1) * count,
      take: count,
    });
  }

  async getPlanAmount(id: string, roomId?: number): Promise<number> {
    const result = await this.planScheduleRepository.find({
      where: ownScope(
        { status: Not(In([PlanScheduleStatus.DELETE])) },
        id,
        roomId,
      ),
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
      where: ownScope({ status: PlanScheduleStatus.NORMAL }, id, roomId),
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
      where: ownScope({ status: PlanScheduleStatus.COMPLETED }, id, roomId),
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
    id?: string,
    roomId?: number,
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
      .where('1=1')
      .andWhere('ps.status IN (:...statusList)', {
        statusList: [PlanScheduleStatus.NORMAL, PlanScheduleStatus.COMPLETED],
      })
      .setParameters({
        normalStatus: PlanScheduleStatus.NORMAL,
        completedStatus: PlanScheduleStatus.COMPLETED,
      })
      .groupBy('ps.categoryName');

    if (id) {
      query.andWhere('ps.planUserId = :id', { id });
    }

    if (roomId) {
      query.andWhere('ps.planUserRoomId = :roomId', { roomId });
    }

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
      where: ownScope(
        {
          status: Not(In([PlanScheduleStatus.DELETE])),
          startDate: Between(startDate, endDate),
        },
        planUserId,
        roomId,
      ),
    });
  }

  async findByIds(ids: number[]): Promise<PlanScheduleEntity[]> {
    return this.planScheduleRepository.find({
      where: { id: In(ids) },
    });
  }
}

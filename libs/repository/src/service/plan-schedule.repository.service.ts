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
  paidSql,
} from '../enum/plan-schedule.enum';

/**
 * "이 사람의 플랜" 의 범위.
 *
 * 방을 주면 작성자와 무관하게 그 방 전체를 본다. 방이 없으면 개인 일정과
 * 내가 방장인 방 전체(배우자가 작성한 일정 포함)를 함께 본다.
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
  if (roomId) return [{ ...base, planUserRoomId: roomId }];
  return [
    { ...base, planUserId, planUserRoomId: IsNull() },
    { ...base, planUserRoom: { ownerId: planUserId } },
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

    const whereConditions = ownScope(baseCondition, planUserId, planUserRoomId);

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

  /**
   * 아직 **안 낸** 돈.
   *
   * 예전에는 `status = NORMAL` 이었다. 그러면 계약금을 미리 낸 일정이
   * 일정만 예정이라는 이유로 "아직 안 쓴 돈" 에 잡힌다 — 통장에서는 이미
   * 빠져나갔는데도. 이제 **결제 여부**로 가른다 (`paidSql`).
   */
  async getPlannedUseAmount(id: string, roomId?: number): Promise<number> {
    return this.sumAmount(id, roomId, false);
  }

  async getPlannedUseAmountByRoomId(roomId: number): Promise<number> {
    return this.sumAmountByRoomId(roomId, false);
  }

  /** 이미 **낸** 돈. 일정이 끝났는지와 무관하다 */
  async getUsedAmount(id: string, roomId?: number): Promise<number> {
    return this.sumAmount(id, roomId, true);
  }

  async getUsedAmountByRoomId(roomId: number): Promise<number> {
    return this.sumAmountByRoomId(roomId, true);
  }

  /** 결제 여부로 가른 금액 합. 지운 일정은 뺀다 */
  private async sumAmount(
    planUserId: string,
    roomId: number | undefined,
    paid: boolean,
  ): Promise<number> {
    const qb = this.planScheduleRepository
      .createQueryBuilder('ps')
      .leftJoin('ps.planUserRoom', 'room')
      .select('COALESCE(SUM(ps.amount), 0)', 'total')
      .where('1=1')
      .andWhere('ps.status <> :deleted', {
        deleted: PlanScheduleStatus.DELETE,
      })
      .andWhere(`${paidSql('ps')} = :paid`, { paid });

    if (roomId) {
      qb.andWhere('ps.plan_user_room_id = :roomId', { roomId });
    } else {
      qb.andWhere(
        '((ps.plan_user_room_id IS NULL AND ps.plan_user_id = :planUserId) OR room.owner_id = :planUserId)',
        { planUserId },
      );
    }

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumAmountByRoomId(
    roomId: number,
    paid: boolean,
  ): Promise<number> {
    const row = await this.planScheduleRepository
      .createQueryBuilder('ps')
      .select('COALESCE(SUM(ps.amount), 0)', 'total')
      .where('ps.plan_user_room_id = :roomId', { roomId })
      .andWhere('ps.status <> :deleted', {
        deleted: PlanScheduleStatus.DELETE,
      })
      .andWhere(`${paidSql('ps')} = :paid`, { paid })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  /**
   * 자랑하기가 쓰는 집계. **여러 사람 것을 한 번에** 센다.
   *
   * 자랑하기는 스냅샷이 아니라 라이브라, 목록 한 장(20명)을 그릴 때마다
   * 사람마다 따로 물으면 쿼리가 20번 나간다. planUserId 를 모아 한 번에
   * 묻고 서비스가 사람별로 접는다.
   *
   * 범위는 `getList` 와 같다 — 개인 일정과 내가 방장인 방의 모든 일정.
   * 공동 일정은 작성자가 아닌 방장에게 집계한다.
   */
  async getBragTotals(planUserIds: string[]): Promise<
    Array<{
      planUserId: string;
      categoryName: string;
      usedAmount: number;
      plannedAmount: number;
      total: number;
      done: number;
    }>
  > {
    if (planUserIds.length === 0) return [];

    const owner =
      'CASE WHEN ps.plan_user_room_id IS NULL THEN ps.plan_user_id ELSE room.owner_id END';
    const rows = await this.planScheduleRepository
      .createQueryBuilder('ps')
      .leftJoin('ps.planUserRoom', 'room')
      .select(owner, 'planUserId')
      .addSelect('ps.category_name', 'categoryName')
      .addSelect(
        `SUM(CASE WHEN ${paidSql('ps')} THEN COALESCE(ps.amount, 0) ELSE 0 END)`,
        'usedAmount',
      )
      .addSelect(
        `SUM(CASE WHEN NOT ${paidSql('ps')} THEN COALESCE(ps.amount, 0) ELSE 0 END)`,
        'plannedAmount',
      )
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN ps.status = :completed THEN 1 ELSE 0 END)`,
        'done',
      )
      .where(`${owner} IN (:...planUserIds)`, { planUserIds })
      .andWhere('ps.status IN (:...statusList)', {
        statusList: [PlanScheduleStatus.NORMAL, PlanScheduleStatus.COMPLETED],
      })
      .setParameter('completed', PlanScheduleStatus.COMPLETED)
      .groupBy(owner)
      .addGroupBy('ps.category_name')
      .getRawMany<{
        planUserId: string;
        categoryName: string;
        usedAmount: string;
        plannedAmount: string;
        total: string;
        done: string;
      }>();

    return rows.map((row) => ({
      planUserId: row.planUserId,
      categoryName: row.categoryName,
      usedAmount: Number(row.usedAmount ?? 0),
      plannedAmount: Number(row.plannedAmount ?? 0),
      total: Number(row.total ?? 0),
      done: Number(row.done ?? 0),
    }));
  }

  async getCategoryChartList(
    id?: string,
    roomId?: number,
    categoryName?: string,
  ): Promise<GetPlanUserAmountCategory[]> {
    const query = this.planScheduleRepository
      .createQueryBuilder('ps')
      .leftJoin('ps.planUserRoom', 'room')
      .select('ps.categoryName', 'categoryName')
      .addSelect(`SUM(ps.amount)`, 'totalAmount')
      .addSelect(
        // 완료가 아니라 **결제** 기준이다 — 미리 낸 계약금도 쓴 돈이다
        `SUM(CASE WHEN ${paidSql('ps')} THEN ps.amount ELSE 0 END)`,
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

    if (roomId) {
      query.andWhere('ps.planUserRoomId = :roomId', { roomId });
    } else if (id) {
      query.andWhere(
        '((ps.plan_user_room_id IS NULL AND ps.plan_user_id = :id) OR room.owner_id = :id)',
        { id },
      );
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
      { planUserId, planUserRoomId: IsNull() },
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

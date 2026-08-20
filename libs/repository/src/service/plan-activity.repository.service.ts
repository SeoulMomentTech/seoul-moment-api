import { DatabaseSort } from '@app/common/enum/global.enum';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { PlanActivityEntity } from '../entity/plan-activity.entity';

@Injectable()
export class PlanActivityRepositoryService {
  constructor(
    @InjectRepository(PlanActivityEntity)
    private readonly planActivityRepository: Repository<PlanActivityEntity>,
  ) {}

  async create(entity: PlanActivityEntity): Promise<PlanActivityEntity> {
    return this.planActivityRepository.save(entity);
  }

  /**
   * 방이 있으면 그 방의 기록을, 없으면 그 사람의 개인 기록을 준다.
   *
   * 개인 기록은 planUserRoomId 가 NULL 인 것만 본다. 방에 참여한 뒤에는
   * 같은 사람의 활동이 방 기록으로 쌓이는데, 그걸 개인 목록에도 끼워 주면
   * 방 화면과 개인 화면에 같은 줄이 두 번 뜬다.
   */
  async findAndCountByScope(
    planUserId: string,
    planUserRoomId: number | null,
    page: number,
    count: number,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[PlanActivityEntity[], number]> {
    const where: FindOptionsWhere<PlanActivityEntity> = planUserRoomId
      ? { planUserRoomId }
      : { planUserId, planUserRoomId: IsNull() };

    return this.planActivityRepository.findAndCount({
      where,
      relations: ['planUser'],
      order: { createDate: sort, id: sort },
      skip: (page - 1) * count,
      take: count,
    });
  }
}

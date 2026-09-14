import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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

  /** 내가 만든 카테고리 */
  private async findUserCategories(
    userId: string,
  ): Promise<PlanUserCategoryEntity[]> {
    return this.planUserCategoryRepository.find({
      select: ['id', 'name'],
      where: { planUserId: userId },
    });
  }

  /**
   * 방에서 공유된 카테고리. **만든 사람을 함께 읽는다** — 화면이 'room'
   * 이라는 영어 한 단어 대신 "민지 추가!" 라고 말하려면 이름이 필요하다.
   */
  private async findRoomCategories(
    roomId: number,
  ): Promise<PlanUserCategoryEntity[]> {
    return this.planUserCategoryRepository.find({
      select: { id: true, name: true, planUser: { id: true, name: true } },
      relations: { planUser: true },
      where: { planUserRoomId: roomId },
    });
  }

  async findAll(
    userId?: string,
    roomId?: number,
  ): Promise<PlanAllCategoryDto[]> {
    const [planCategories, planUserCategories, planRoomCategories] =
      await Promise.all([
        this.planCategoryRepository.find({ select: ['id', 'name'] }),
        userId ? this.findUserCategories(userId) : [],
        roomId ? this.findRoomCategories(roomId) : [],
      ]);

    return [
      ...planCategories.map((c) =>
        PlanAllCategoryDto.from(c.id, c.name, PlanCategoryType.SYSTEM),
      ),
      ...planUserCategories.map((c) =>
        PlanAllCategoryDto.from(c.id, c.name, PlanCategoryType.USER),
      ),
      ...planRoomCategories.map((c) =>
        PlanAllCategoryDto.from(
          c.id,
          c.name,
          PlanCategoryType.ROOM,
          c.planUser?.name ?? undefined,
        ),
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

import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import { PlanUserCategoryEntity } from '@app/repository/entity/plan-user-category.entity';
import { PlanCategoryRepositoryService } from '@app/repository/service/plan-category.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  PostPlanScheduleRequest,
  PostPlanScheduleResponse,
} from './plan-schedule.dto';

@Injectable()
export class PlanScheduleService {
  constructor(
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planCategoryRepositoryService: PlanCategoryRepositoryService,
  ) {}

  @Transactional()
  async postPlanSchedule(
    id: string,
    postPlanScheduleRequest: PostPlanScheduleRequest,
  ): Promise<PostPlanScheduleResponse> {
    const planSchedule = await this.planScheduleRepositoryService.create(
      plainToInstance(PlanScheduleEntity, {
        planUserId: id,
        categoryName: postPlanScheduleRequest.categoryName,
        title: postPlanScheduleRequest.title,
        payType: postPlanScheduleRequest.payType,
        amount: postPlanScheduleRequest.amount,
        startDate: new Date(postPlanScheduleRequest.startDate),
        location: postPlanScheduleRequest.location,
        locationLat: postPlanScheduleRequest.locationLat,
        locationLng: postPlanScheduleRequest.locationLng,
        memo: postPlanScheduleRequest.memo,
      }),
    );

    await this.planCategoryRepositoryService.bulkInsert(
      postPlanScheduleRequest.addCategoryNameList.map((name) =>
        plainToInstance(PlanUserCategoryEntity, {
          planUserId: id,
          name,
        }),
      ),
    );

    return PostPlanScheduleResponse.from(planSchedule);
  }
}

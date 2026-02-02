import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PlanUserService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
  ) {}
}

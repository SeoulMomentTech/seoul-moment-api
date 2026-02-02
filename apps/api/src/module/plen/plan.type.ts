import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { Request } from 'express';

export type PlanUserRequest = Request & { user: PlanUserEntity };

import { RequireKey } from '@app/common/type/require-key.type';

import { PlanScheduleEntity } from '../entity/plan-schedule.entity';

export type UpdatePlanScheduleDto = RequireKey<PlanScheduleEntity, 'id'>;

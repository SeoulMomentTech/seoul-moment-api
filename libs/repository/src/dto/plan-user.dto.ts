import { RequireKey } from '@app/common/type/require-key.type';

import { PlanUserEntity } from '../entity/plan-user.entity';

export type UpdatePlanUserDto = RequireKey<PlanUserEntity, 'id'>;

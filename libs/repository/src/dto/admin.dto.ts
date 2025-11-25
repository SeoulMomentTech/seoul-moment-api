import { RequireKey } from '@app/common/type/require-key.type';

import { AdminEntity } from '../entity/admin.entity';

export type UpdateAdminDto = RequireKey<AdminEntity, 'id'>;

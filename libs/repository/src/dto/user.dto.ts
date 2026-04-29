import { RequireKey } from '@app/common/type/require-key.type';

import { UserEntity } from '../entity/user.entity';

export type UpdateUserDto = RequireKey<UserEntity, 'id'>;

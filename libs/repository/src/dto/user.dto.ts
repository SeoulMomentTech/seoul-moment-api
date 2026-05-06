import { RequireKey } from '@app/common/type/require-key.type';

import { UserFitEntity } from '../entity/user-fit.entity';
import { UserProfileEntity } from '../entity/user-profile.entity';
import { UserEntity } from '../entity/user.entity';

export type UpdateUserDto = RequireKey<UserEntity, 'id'>;
export type UpdateUserProfileDto = RequireKey<UserProfileEntity, 'userId'>;
export type UpdateUserFitDto = RequireKey<UserFitEntity, 'userId'>;

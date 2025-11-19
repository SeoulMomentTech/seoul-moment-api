import { RequireKey } from '@app/common/type/require-key.type';

import { CategoryEntity } from '../entity/category.entity';

export type UpdateCategoryDto = RequireKey<CategoryEntity, 'id'>;

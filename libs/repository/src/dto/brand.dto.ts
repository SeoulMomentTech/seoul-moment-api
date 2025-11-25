import { RequireKey } from '@app/common/type/require-key.type';

import { BrandEntity } from '../entity/brand.entity';

export type UpdateBrandDto = RequireKey<BrandEntity, 'id'>;

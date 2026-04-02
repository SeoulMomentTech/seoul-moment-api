import { RequireKey } from '@app/common/type/require-key.type';

import { HomeBannerImageEntity } from '../entity/home-banner-image.entity';

export type UpdateHomeBannerDto = RequireKey<HomeBannerImageEntity, 'id'>;

import { RequireKey } from '@app/common/type/require-key.type';

import { NewsEntity } from '../entity/news.entity';

export type UpdateNewsDto = RequireKey<NewsEntity, 'id'>;

import { DatabaseSort } from '@app/common/enum/global.enum';
import { RequireKey } from '@app/common/type/require-key.type';

import { NewsEntity } from '../entity/news.entity';
import { NewsSearchEnum } from '../enum/news.repository.enum';

export type UpdateNewsDto = RequireKey<NewsEntity, 'id'>;

export interface FindNewsFilterDto {
  page: number;
  count: number;
  searchName?: string;
  searchColumn?: NewsSearchEnum;
  sort?: DatabaseSort;
  newsCategoryId?: number;
  hashtagId?: number;
  isEditorPick?: boolean;
}

import { RequireKey } from '@app/common/type/require-key.type';

import { ArticleEntity } from '../entity/article.entity';

export type UpdateArticleDto = RequireKey<ArticleEntity, 'id'>;

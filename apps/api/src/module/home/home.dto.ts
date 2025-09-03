import { ArticleEntity } from '@app/repository/entity/article.entity';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeSectionEntity } from '@app/repository/entity/home-section.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { plainToInstance } from 'class-transformer';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetHomeSection {
  title: string;
  description: string;
  url: string;
  image: string[];

  static from(
    entity: HomeSectionEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');

    const description = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'description',
    );

    return plainToInstance(this, {
      title: title.getContent(),
      description: description.getContent(),
      url: entity.url,
      image: entity.sectionImage.map((v) => v.getImage()),
    });
  }
}

export class GetHomeNews {
  id: number;
  title: string;
  content: string;
  writer: string;
  createDate: string;
  image: string;

  static from(entity: NewsEntity, multilingualText: MultilingualTextEntity[]) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');
    const content = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'content',
    );

    return plainToInstance(this, {
      id: entity.id,
      title: title.getContent(),
      content: content.getContent(),
      writer: entity.writer,
      createDate: entity.createDate,
      image: entity.getBannerImage(),
    });
  }
}

export class GetHomeArticle {
  id: number;
  title: string;
  content: string;
  writer: string;
  createDate: string;
  image: string;

  static from(
    entity: ArticleEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');
    const content = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'content',
    );

    return plainToInstance(this, {
      id: entity.id,
      title: title.getContent(),
      content: content.getContent(),
      writer: entity.writer,
      createDate: entity.createDate,
      image: entity.getBannerImage(),
    });
  }
}

export class GetHomeResponse {
  banner: string[];
  section: GetHomeSection[];
  news: GetHomeNews[];
  article: GetHomeArticle[];

  static from(
    banner: HomeBannerImageEntity[],
    section: HomeSectionEntity[],
    sectionMultilingualTextEntity: MultilingualTextEntity[],
    news: NewsEntity[],
    newsMultilingualTextEntity: MultilingualTextEntity[],
    article: ArticleEntity[],
    articleMultilingualTextEntity: MultilingualTextEntity[],
  ) {
    return plainToInstance(this, {
      banner: banner.map((v) => v.getImage()),
      section: section.map((v) =>
        GetHomeSection.from(v, sectionMultilingualTextEntity),
      ),
      news: news.map((v) => GetHomeNews.from(v, newsMultilingualTextEntity)),
      article: article.map((v) =>
        GetHomeArticle.from(v, articleMultilingualTextEntity),
      ),
    });
  }
}

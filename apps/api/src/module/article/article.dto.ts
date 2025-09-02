import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { plainToInstance } from 'class-transformer';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetLastArticle {
  id: number;
  banner: string;
  title: string;

  static from(
    entity: ArticleEntity,
    multilingualText: MultilingualTextEntity[],
    language: LanguageCode,
  ) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const title = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'title')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );

    return plainToInstance(this, {
      id: entity.id,
      banner: entity.getBannerImage(),
      title: title.getContentByLanguage(language),
    });
  }
}

export class GetArticleSection {
  title: string;
  subTitle: string;
  content: string;
  iamgeList: string[];

  static from(
    entity: ArticleSectionEntity,
    multilingualText: MultilingualTextEntity[],
    language: LanguageCode,
  ) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const title = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'title')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );
    const subTitle = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'subTitle')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );
    const content = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'content')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );

    return plainToInstance(this, {
      title: title.getContentByLanguage(language),
      subTitle: subTitle.getContentByLanguage(language),
      content: content.getContentByLanguage(language),
      iamgeList: entity.sectionImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
    });
  }
}

export class GetArticleResponse {
  id: number;
  writer: string;
  category: string;
  title: string;
  content: string;
  banner: string;
  profileImage: string;
  lastArticle: GetLastArticle[];
  section: GetArticleSection;

  static from(
    entity: ArticleEntity,
    multilingualText: {
      text: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
    lastArticleList: ArticleEntity[],
    lastArticleMultilingual: MultilingualTextEntity[],
    language: LanguageCode,
  ) {
    const title = new MultilingualFieldDto(
      multilingualText.text
        .filter((v) => v.fieldName === 'title')
        .map((text) => ({
          content: text.textContent,
          language: text.language.code,
        })),
    );

    const content = new MultilingualFieldDto(
      multilingualText.text
        .filter((v) => v.fieldName === 'content')
        .map((text) => ({
          content: text.textContent,
          language: text.language.code,
        })),
    );

    return plainToInstance(this, {
      id: entity.id,
      writer: entity.writer,
      category: entity.category.name,
      title: title.getContentByLanguage(language),
      content: content.getContentByLanguage(language),
      banner: entity.getBannerImage(),
      profileImage: entity.getProfileImage(),
      lastArticle: lastArticleList.map((v) =>
        GetLastArticle.from(v, lastArticleMultilingual, language),
      ),
      section: entity.section.map((v) =>
        GetArticleSection.from(v, multilingualText.sectionText, language),
      ),
    });
  }
}

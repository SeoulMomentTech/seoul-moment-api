import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { NewsCategoryEntity } from '../libs/repository/src/entity/news-category.entity';
import { NewsHashtagEntity } from '../libs/repository/src/entity/news-hashtag.entity';
import { NewsEntity } from '../libs/repository/src/entity/news.entity';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';
import { NewsRepositoryService } from '../libs/repository/src/service/news.repository.service';

describe('GET /news/dashboard', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;
  let newsRepositoryService: NewsRepositoryService;

  beforeAll(async () => {
    // Given - 앱/서비스 준비 및 언어 시드
    app = await getTestApp();
    dataSource = getDataSource(app);
    languageRepositoryService = app.get(LanguageRepositoryService);
    newsRepositoryService = app.get(NewsRepositoryService);

    const languages = await dataSource.query(`SELECT id FROM language LIMIT 1`);
    if (languages.length === 0) {
      await dataSource.query(
        `INSERT INTO language (code, name, english_name, is_active, sort_order)
         VALUES ('ko', '한국어', 'Korean', true, 1),
                ('en', 'English', 'English', true, 2),
                ('zh-TW', '中文', 'Taiwan', true, 3)`,
      );
    }
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'news_section_image',
      'news_section',
      'news',
      'news_hashtag',
      'news_category',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function insertNews(partial: Partial<NewsEntity> = {}) {
    return newsRepositoryService.insert({
      writer: faker.person.fullName(),
      ...partial,
    } as NewsEntity);
  }

  async function saveHashtagName(
    hashtagId: number,
    ko: string,
    en?: string,
  ): Promise<void> {
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      EntityType.NEWS_HASHTAG,
      hashtagId,
      'name',
      LanguageCode.KOREAN,
      ko,
    );
    if (en) {
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.NEWS_HASHTAG,
        hashtagId,
        'name',
        LanguageCode.ENGLISH,
        en,
      );
    }
  }

  async function saveCategoryName(
    categoryId: number,
    ko: string,
    en?: string,
  ): Promise<void> {
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      EntityType.NEWS_CATEGORY,
      categoryId,
      'name',
      LanguageCode.KOREAN,
      ko,
    );
    if (en) {
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.NEWS_CATEGORY,
        categoryId,
        'name',
        LanguageCode.ENGLISH,
        en,
      );
    }
  }

  it('데이터가 하나도 없어도 200과 빈 대시보드를 반환한다 (해시태그 0건 가드)', async () => {
    // Given - 뉴스/해시태그/카테고리 없음

    // When
    const res = await request(app.getHttpServer())
      .get('/news/dashboard')
      .set('Accept-language', LanguageCode.KOREAN);

    // Then
    expect(res.status).toBe(200);
    expect(res.body.data.recentList).toEqual([]);
    expect(res.body.data.editorPickList).toEqual([]);
    expect(res.body.data.hashtag.name).toBeUndefined();
    expect(res.body.data.hashtag.list).toEqual([]);
    expect(res.body.data.newsCategoryList).toEqual([]);
  });

  it('최근/에디터픽/해시태그/카테고리 리스트를 각 조건에 맞게 반환한다', async () => {
    // Given - 해시태그/카테고리 시드
    const hashtag = await dataSource
      .getRepository(NewsHashtagEntity)
      .save({} as Partial<NewsHashtagEntity>);
    await saveHashtagName(hashtag.id, '뷰티', 'Beauty');

    const category = await dataSource
      .getRepository(NewsCategoryEntity)
      .save({} as Partial<NewsCategoryEntity>);
    await saveCategoryName(category.id, '라이프스타일', 'Lifestyle');

    // Given - 뉴스 시드: 일반 1건, 에디터픽 5건, 해시태그 2건, 카테고리 2건
    const plainNews = await insertNews();

    const editorPickIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const news = await insertNews({ editorPick: true });
      editorPickIds.push(news.id);
    }

    const hashtagNewsIds: number[] = [];
    for (let i = 0; i < 2; i++) {
      const news = await insertNews({ hashtagId: hashtag.id });
      hashtagNewsIds.push(news.id);
    }

    const categoryNewsIds: number[] = [];
    for (let i = 0; i < 2; i++) {
      const news = await insertNews({ newsCategoryId: category.id });
      categoryNewsIds.push(news.id);
    }

    // When
    const res = await request(app.getHttpServer())
      .get('/news/dashboard')
      .set('Accept-language', LanguageCode.KOREAN);

    // Then - 최근 리스트는 최신 5건 (총 10건 중)
    expect(res.status).toBe(200);
    expect(res.body.data.recentList).toHaveLength(5);
    const recentIds = res.body.data.recentList.map((v: { id: number }) => v.id);
    expect(recentIds).not.toContain(plainNews.id);

    // Then - 에디터픽 리스트는 editorPick=true 뉴스만 4건
    expect(res.body.data.editorPickList).toHaveLength(4);
    for (const item of res.body.data.editorPickList) {
      expect(editorPickIds).toContain(item.id);
    }

    // Then - 해시태그 섹션은 다국어 이름 + 해당 해시태그 뉴스만
    expect(res.body.data.hashtag.name).toBe('뷰티');
    const hashtagListIds = res.body.data.hashtag.list.map(
      (v: { id: number }) => v.id,
    );
    expect(hashtagListIds.sort()).toEqual(hashtagNewsIds.sort());

    // Then - 카테고리 리스트는 다국어 이름으로 시드한 카테고리를 반환
    expect(res.body.data.newsCategoryList).toEqual([
      { categoryId: category.id, name: '라이프스타일' },
    ]);

    // Then - 카테고리에 속한 뉴스 카드에는 카테고리 이름이 채워진다
    const categoryCards = [
      ...res.body.data.recentList,
      ...res.body.data.newsCategoryCardList,
    ].filter((v: { id: number }) => categoryNewsIds.includes(v.id));
    expect(categoryCards.length).toBeGreaterThan(0);
    for (const card of categoryCards) {
      expect(card.newsCategoryName).toBe('라이프스타일');
    }

    // When - 영어로 요청
    const enRes = await request(app.getHttpServer())
      .get('/news/dashboard')
      .set('Accept-language', LanguageCode.ENGLISH);

    // Then - 해시태그/카테고리 이름이 영어로 반환
    expect(enRes.status).toBe(200);
    expect(enRes.body.data.hashtag.name).toBe('Beauty');
    expect(enRes.body.data.newsCategoryList).toEqual([
      { categoryId: category.id, name: 'Lifestyle' },
    ]);
  });

  it('해시태그가 여러 개면 id가 가장 작은 해시태그를 기준으로 반환한다', async () => {
    // Given - 해시태그 2개 (id 오름차순)
    const firstHashtag = await dataSource
      .getRepository(NewsHashtagEntity)
      .save({} as Partial<NewsHashtagEntity>);
    const secondHashtag = await dataSource
      .getRepository(NewsHashtagEntity)
      .save({} as Partial<NewsHashtagEntity>);

    await saveHashtagName(firstHashtag.id, '첫번째');
    await saveHashtagName(secondHashtag.id, '두번째');

    const firstNews = await insertNews({ hashtagId: firstHashtag.id });
    await insertNews({ hashtagId: secondHashtag.id });

    // When
    const res = await request(app.getHttpServer())
      .get('/news/dashboard')
      .set('Accept-language', LanguageCode.KOREAN);

    // Then - 첫 번째(id 최소) 해시태그의 이름과 뉴스만 반환
    expect(res.status).toBe(200);
    expect(res.body.data.hashtag.name).toBe('첫번째');
    expect(res.body.data.hashtag.list.map((v: { id: number }) => v.id)).toEqual(
      [firstNews.id],
    );
  });

  it('카테고리 카드 리스트는 카테고리 필터 없이 최신 4건을 반환하고, 카드마다 자기 카테고리 이름이 채워진다', async () => {
    // Given - 카테고리 1개(다국어 이름)
    const category = await dataSource
      .getRepository(NewsCategoryEntity)
      .save({} as Partial<NewsCategoryEntity>);
    await saveCategoryName(category.id, '브랜드뉴스');

    // Given - 카테고리 없는 뉴스 3건 → 카테고리 뉴스 3건 순으로 시드 (총 6건)
    const noCategoryIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const news = await insertNews();
      noCategoryIds.push(news.id);
    }
    const categoryNewsIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const news = await insertNews({ newsCategoryId: category.id });
      categoryNewsIds.push(news.id);
    }

    // When
    const res = await request(app.getHttpServer())
      .get('/news/dashboard')
      .set('Accept-language', LanguageCode.KOREAN);

    // Then - 카드 리스트는 카테고리 필터 없이 최신 4건만 반환
    expect(res.status).toBe(200);
    expect(res.body.data.newsCategoryCardList).toHaveLength(4);

    // Then - 카테고리 없는 뉴스도 카드 리스트에 포함된다 (필터 미적용 증명)
    const cardIds: number[] = res.body.data.newsCategoryCardList.map(
      (v: { id: number }) => v.id,
    );
    expect(cardIds.some((id) => noCategoryIds.includes(id))).toBe(true);

    // Then - 카드의 카테고리 이름은 각 뉴스의 카테고리 소속에 따라 채워진다
    for (const card of res.body.data.newsCategoryCardList) {
      if (categoryNewsIds.includes(card.id)) {
        expect(card.newsCategoryName).toBe('브랜드뉴스');
      } else {
        expect(card.newsCategoryName).toBeNull();
      }
    }
  });

  it('에디터픽 뉴스가 없으면 editorPickList는 빈 배열이다', async () => {
    // Given - editorPick=false 뉴스만 존재
    await insertNews();
    await insertNews({ editorPick: false });

    // When
    const res = await request(app.getHttpServer())
      .get('/news/dashboard')
      .set('Accept-language', LanguageCode.KOREAN);

    // Then
    expect(res.status).toBe(200);
    expect(res.body.data.editorPickList).toEqual([]);
    expect(res.body.data.recentList).toHaveLength(2);
  });
});

import { INestApplication } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * QueryRunner로 트랜잭션을 시작하고, 테스트가 끝나면 롤백한다.
 * TRUNCATE보다 빠르고 외래키 cascade 비용이 없다.
 *
 * 사용 예:
 *   await withRollback(dataSource, async (qr) => {
 *     await qr.manager.save(NewsEntity, news);
 *     const result = await service.findAll();
 *     expect(result).toHaveLength(1);
 *   });
 */
export async function withRollback(
  dataSource: DataSource,
  fn: (qr: QueryRunner) => Promise<void>,
): Promise<void> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await fn(qr);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}

/**
 * 지정한 테이블들을 TRUNCATE하고 시퀀스를 초기화한다.
 * afterEach에서 간단하게 정리가 필요할 때 사용한다.
 *
 * 사용 예:
 *   afterEach(() => truncateTables(dataSource, ['news', 'article']));
 */
export async function truncateTables(
  dataSource: DataSource,
  tableNames: string[],
): Promise<void> {
  const tables = tableNames.join(', ');
  await dataSource.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

/**
 * NestJS 앱 인스턴스에서 TypeORM DataSource를 꺼낸다.
 *
 * 사용 예:
 *   const dataSource = getDataSource(app);
 */
export function getDataSource(app: INestApplication): DataSource {
  return app.get(DataSource);
}

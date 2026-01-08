import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

/**
 * SortOrder 관리를 위한 헬퍼 서비스
 * 모든 entity의 sortOrder 자동 설정을 담당
 */
@Injectable()
export class SortOrderHelper {
  /**
   * 다음 sortOrder 값을 계산하여 반환
   * @param repository - TypeORM Repository 인스턴스
   * @returns 다음 sortOrder 값 (기존 최대값 + 1)
   */
  async getNextSortOrder<T>(repository: Repository<T>): Promise<number> {
    const queryBuilder = repository
      .createQueryBuilder('table')
      .select(`MAX(table.sortOrder)`, 'max');

    const result = await queryBuilder.getRawOne();
    return (result?.max || 0) + 1;
  }

  /**
   * Entity에 자동으로 sortOrder를 설정
   * sortOrder가 이미 설정되어 있으면 그대로 유지
   * @param entity - sortOrder를 설정할 entity
   * @param repository - TypeORM Repository 인스턴스
   */
  async setNextSortOrder<T extends { sortOrder?: number }>(
    entity: T,
    repository: Repository<T>,
  ): Promise<void> {
    if (!entity.sortOrder) {
      entity.sortOrder = await this.getNextSortOrder(repository);
    }
  }
}

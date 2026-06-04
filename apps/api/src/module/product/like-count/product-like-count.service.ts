import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { ProductLikeCountDto } from '@app/repository/dto/product.dto';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable, Logger } from '@nestjs/common';

import { ProductLikeCountCollectionDto } from './product-like-count.dto';

const LIKE_COUNT_TTL_SECONDS = 60 * 60;

@Injectable()
export class ProductLikeCountService {
  private readonly logger = new Logger(ProductLikeCountService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  private buildKey(productItemId: number): string {
    return `${RedisKey.PRODUCT_LIKE_COUNT}:${productItemId}`;
  }

  // 좋아요 토글의 트랜잭션 안에서 호출. 컬럼 갱신(source of truth)은 트랜잭션에 합류하고,
  // 캐시에는 카운트 값을 직접 쓰지 않고 무효화(del)만 한다 — 트랜잭션 커밋 전 RETURNING
  // 값을 그대로 캐싱하면 동시성/롤백 시 잘못된 카운트가 캐시에 남으므로, 다음 읽기에서
  // 컬럼값으로 재적재되도록 한다. 무효화는 best-effort(Redis 장애가 좋아요를 막지 않도록).
  async increment(productItemId: number): Promise<void> {
    await this.productRepositoryService.incrementLikeCount(productItemId);

    await this.invalidate(productItemId);
  }

  async decrement(productItemId: number): Promise<void> {
    await this.productRepositoryService.decrementLikeCount(productItemId);

    await this.invalidate(productItemId);
  }

  async getCounts(
    productItemIds: number[],
  ): Promise<ProductLikeCountCollectionDto> {
    if (productItemIds.length === 0) {
      return ProductLikeCountCollectionDto.from([]);
    }

    const cached = await this.readCache(productItemIds);

    const items: ProductLikeCountDto[] = [];
    const missedIds: number[] = [];

    productItemIds.forEach((id, index) => {
      const value = cached[index];
      if (value === null) {
        missedIds.push(id);
      } else {
        items.push(ProductLikeCountDto.from(id, Number(value)));
      }
    });

    items.push(...(await this.fillFromDb(missedIds)));

    return ProductLikeCountCollectionDto.from(items);
  }

  // Redis 장애 시 전부 miss 처리하여 DB 컬럼으로 폴백(읽기 경로 가용성 보호).
  private async readCache(
    productItemIds: number[],
  ): Promise<(string | null)[]> {
    try {
      return await this.cacheService.mget(
        productItemIds.map((id) => this.buildKey(id)),
      );
    } catch (error) {
      this.logger.warn(`Failed to read like count cache: ${error.message}`);
      return productItemIds.map(() => null);
    }
  }

  private async fillFromDb(
    missedIds: number[],
  ): Promise<ProductLikeCountDto[]> {
    if (missedIds.length === 0) {
      return [];
    }

    const dbCounts =
      await this.productRepositoryService.findLikeCounts(missedIds);
    const countByItemId = new Map(
      dbCounts.map((v) => [v.productItemId, v.count]),
    );

    const items: ProductLikeCountDto[] = [];
    for (const id of missedIds) {
      const count = countByItemId.get(id) ?? 0;
      items.push(ProductLikeCountDto.from(id, count));
      await this.cacheCount(id, count);
    }

    return items;
  }

  private async cacheCount(
    productItemId: number,
    count: number,
  ): Promise<void> {
    try {
      await this.cacheService.set(
        this.buildKey(productItemId),
        count,
        LIKE_COUNT_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to cache like count for ${productItemId}: ${error.message}`,
      );
    }
  }

  private async invalidate(productItemId: number): Promise<void> {
    try {
      await this.cacheService.del(this.buildKey(productItemId));
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate like count cache for ${productItemId}: ${error.message}`,
      );
    }
  }
}

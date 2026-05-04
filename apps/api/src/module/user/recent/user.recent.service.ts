import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { PagingDto } from '@app/common/dto/global.dto';
import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { UserRecentEntity } from '@app/repository/entity/user.recent.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ProductSortColumn } from '@app/repository/enum/product.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { UserLikeRepositoryService } from '@app/repository/service/user.like.repository.service';
import { UserRecentRepositoryService } from '@app/repository/service/user.recent.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  GetUserRecentProductResponse,
  GetUserRecentRequest,
  PostUserRecentRequest,
} from './user.recent.dto';

@Injectable()
export class UserRecentService {
  constructor(
    private readonly userRecentRepositoryService: UserRecentRepositoryService,
    private readonly cacheService: CacheService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly userLikeRepositoryService: UserLikeRepositoryService,
  ) {}

  async postUserRecent(
    userId: number,
    request: PostUserRecentRequest,
  ): Promise<void> {
    const productItemExists =
      await this.productRepositoryService.existProductItemById(
        request.productItemId,
      );

    if (!productItemExists) {
      throw new ServiceError(
        `Product item not found`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const key = `${RedisKey.USER_RECENT}:${userId}`;
    const productItemId = request.productItemId.toString();

    await this.cacheService.lrem(key, 0, productItemId);
    await this.cacheService.lpush(key, productItemId);
  }

  private async buildProductResponseList(
    productItems: ProductItemEntity[],
    language: LanguageCode,
  ): Promise<GetUserRecentProductResponse[]> {
    if (productItems.length === 0) {
      return [];
    }

    const [brandText, productText, likeCountMap] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND,
        productItems.map((v) => v.product.brand.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT,
        productItems.map((v) => v.product.id),
        language,
      ),
      this.userLikeRepositoryService.countByProductItemIds(
        productItems.map((v) => v.id),
      ),
    ]);

    return productItems.map((v) =>
      GetUserRecentProductResponse.from(
        v,
        { brand: brandText, product: productText },
        likeCountMap.get(v.id) ?? 0,
      ),
    );
  }

  private async syncRecentCacheToDb(userId: number): Promise<void> {
    const key = `${RedisKey.USER_RECENT}:${userId}`;
    const inMemoryUserRecentList = await this.cacheService.getList(key);

    if (inMemoryUserRecentList.length === 0) {
      return;
    }

    await this.userRecentRepositoryService.createBulk(
      inMemoryUserRecentList.map((v) =>
        plainToInstance(UserRecentEntity, {
          userId,
          productItemId: Number(v),
        }),
      ),
    );

    await this.cacheService.del(key);
  }

  async getUserRecentList(
    userId: number,
    dto: GetUserRecentRequest,
    language: LanguageCode,
  ): Promise<[GetUserRecentProductResponse[], number]> {
    await this.syncRecentCacheToDb(userId);

    const [userRecentEntities, total] =
      await this.userRecentRepositoryService.getList(
        userId,
        dto.page,
        dto.count,
      );

    const result = await this.buildProductResponseList(
      userRecentEntities.map((v) => v.productItem),
      language,
    );

    return [result, total];
  }

  async getTopProductCategory(
    userId: number,
    language: LanguageCode,
  ): Promise<GetUserRecentProductResponse[]> {
    await this.syncRecentCacheToDb(userId);

    const topProductCategory =
      await this.userRecentRepositoryService.getTopProductCategory(userId);

    if (!topProductCategory) {
      return [];
    }

    const [userRecentEntities] = await this.userRecentRepositoryService.getList(
      userId,
      1,
      9999,
      topProductCategory,
    );

    const withoutIdList = userRecentEntities.map((v) => v.productItem.id);

    const [productItemList] =
      await this.productRepositoryService.findProductItem(
        PagingDto.from(1, 4),
        ProductSortDto.from(ProductSortColumn.CREATE, DatabaseSort.DESC),
        undefined,
        undefined,
        topProductCategory,
        undefined,
        undefined,
        undefined,
        undefined,
        withoutIdList,
      );

    return this.buildProductResponseList(productItemList, language);
  }
}

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { UserBrandLikeEntity } from '@app/repository/entity/user-brand-like.entity';
import { UserProductLikeEntity } from '@app/repository/entity/user-product-like.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { UserLikeRepositoryService } from '@app/repository/service/user.like.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  GetUserBrandLikeRequest,
  GetUserBrandLikeResponse,
  GetUserProductLikeRequest,
  GetUserProductLikeResponse,
} from './user.like.dto';

@Injectable()
export class UserLikeService {
  constructor(
    private readonly userLikeRepositoryService: UserLikeRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async createUserProductLike(userId: number, productItemId: number) {
    await this.productRepositoryService.getProductItemById(productItemId);

    const exist = await this.userLikeRepositoryService.existUserProductLike(
      userId,
      productItemId,
    );

    if (exist) {
      throw new ServiceError(
        'Already liked product item',
        ServiceErrorCode.CONFLICT,
      );
    }

    await this.userLikeRepositoryService.createUserProductLike(
      plainToInstance(UserProductLikeEntity, {
        userId,
        productItemId,
      }),
    );
  }

  async createUserBrandLike(userId: number, brandId: number) {
    await this.brandRepositoryService.getBrandById(brandId);

    const exist = await this.userLikeRepositoryService.existUserBrandLike(
      userId,
      brandId,
    );

    if (exist) {
      throw new ServiceError('Already liked brand', ServiceErrorCode.CONFLICT);
    }

    await this.userLikeRepositoryService.createUserBrandLike(
      plainToInstance(UserBrandLikeEntity, {
        userId,
        brandId,
      }),
    );
  }

  async deleteUserProductLike(userId: number, productItemId: number) {
    await this.userLikeRepositoryService.deleteUserProductLike(
      userId,
      productItemId,
    );
  }

  async deleteUserBrandLike(userId: number, brandId: number) {
    await this.userLikeRepositoryService.deleteUserBrandLike(userId, brandId);
  }

  async getUserProductLikeList(
    userId: number,
    dto: GetUserProductLikeRequest,
    language: LanguageCode,
  ): Promise<[GetUserProductLikeResponse[], number]> {
    const [productLikeEntities, total] =
      await this.userLikeRepositoryService.getUserProductLikeList(
        userId,
        dto.page,
        dto.count,
        dto.productCategoryId,
      );

    const [brandText, productText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND,
        productLikeEntities.map((v) => v.productItem.product.brand.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT,
        productLikeEntities.map((v) => v.productItem.product.id),
        language,
      ),
    ]);

    return [
      productLikeEntities.map((v) =>
        GetUserProductLikeResponse.from(v, {
          brand: brandText,
          product: productText,
        }),
      ),
      total,
    ];
  }

  async getUserBrandLikeList(
    userId: number,
    dto: GetUserBrandLikeRequest,
    language: LanguageCode,
  ): Promise<[GetUserBrandLikeResponse[], number]> {
    const [userBrandLikeDtos, total] =
      await this.userLikeRepositoryService.getUserBrandLikeList(
        userId,
        dto.page,
        dto.count,
      );

    const [brandText, productText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND,
        userBrandLikeDtos.map((v) => v.brand.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT,
        userBrandLikeDtos.flatMap((v) => v.brand.products.map((p) => p.id)),
        language,
      ),
    ]);

    return [
      userBrandLikeDtos.map((v) =>
        GetUserBrandLikeResponse.from(v, {
          brand: brandText,
          product: productText,
        }),
      ),
      total,
    ];
  }
}

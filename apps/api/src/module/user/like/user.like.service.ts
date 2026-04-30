import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { UserBrandLikeEntity } from '@app/repository/entity/user-brand-like.entity';
import { UserProductLikeEntity } from '@app/repository/entity/user-product-like.entity';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { UserLikeRepositoryService } from '@app/repository/service/user.like.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UserLikeService {
  constructor(
    private readonly userLikeRepositoryService: UserLikeRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
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
}

import { plainToInstance } from 'class-transformer';

import { BrandEntity } from '../entity/brand.entity';
import { UserBrandLikeEntity } from '../entity/user-brand-like.entity';

export class UserBrandLikeDto {
  brand: BrandEntity;
  totalLikeCount: number;

  static from(
    entity: UserBrandLikeEntity,
    totalLikeCount: number,
  ): UserBrandLikeDto {
    return plainToInstance(UserBrandLikeDto, {
      brand: entity.brand,
      totalLikeCount,
    });
  }
}

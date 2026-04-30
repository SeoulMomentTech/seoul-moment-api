import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserBrandLikeEntity } from '../entity/user-brand-like.entity';
import { UserProductLikeEntity } from '../entity/user-product-like.entity';

@Injectable()
export class UserLikeRepositoryService {
  constructor(
    @InjectRepository(UserProductLikeEntity)
    private readonly userProductLikeRepository: Repository<UserProductLikeEntity>,
    @InjectRepository(UserBrandLikeEntity)
    private readonly userBrandLikeRepository: Repository<UserBrandLikeEntity>,
  ) {}

  async existUserProductLike(
    userId: number,
    productItemId: number,
  ): Promise<boolean> {
    return this.userProductLikeRepository.exists({
      where: { userId, productItemId },
    });
  }

  async existUserBrandLike(userId: number, brandId: number): Promise<boolean> {
    return this.userBrandLikeRepository.exists({
      where: { userId, brandId },
    });
  }

  async createUserProductLike(
    userProductLike: UserProductLikeEntity,
  ): Promise<UserProductLikeEntity> {
    return this.userProductLikeRepository.save(userProductLike);
  }

  async createUserBrandLike(
    userBrandLike: UserBrandLikeEntity,
  ): Promise<UserBrandLikeEntity> {
    return this.userBrandLikeRepository.save(userBrandLike);
  }

  async deleteUserProductLike(userId: number, productItemId: number) {
    return this.userProductLikeRepository.delete({ userId, productItemId });
  }

  async deleteUserBrandLike(userId: number, brandId: number) {
    return this.userBrandLikeRepository.delete({ userId, brandId });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserBrandLikeDto } from './user.like.dto';
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

  async getUserProductLikeList(
    userId: number,
    page: number,
    count: number,
    productCategoryId?: number,
  ): Promise<[UserProductLikeEntity[], number]> {
    const query = this.userProductLikeRepository.createQueryBuilder('upl');

    query
      .leftJoinAndSelect('upl.productItem', 'pi')
      .leftJoinAndSelect('pi.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .where('upl.userId = :userId', { userId });

    if (productCategoryId) {
      query.andWhere('p.product_category_id = :productCategoryId', {
        productCategoryId,
      });
    }

    return query
      .skip((page - 1) * count)
      .take(count)
      .orderBy('upl.createDate', 'DESC')
      .getManyAndCount();
  }

  async getUserBrandLikeList(
    userId: number,
    page: number,
    count: number,
  ): Promise<[UserBrandLikeDto[], number]> {
    const query = this.userBrandLikeRepository.createQueryBuilder('ubl');

    query
      .leftJoinAndSelect('ubl.brand', 'b')
      .leftJoinAndSelect('b.products', 'p')
      .leftJoinAndSelect('p.productItems', 'pi')
      .leftJoinAndSelect('pi.product', 'pp')
      .where('ubl.userId = :userId', { userId });

    const [userBrandLikeEntities, total] = await query
      .skip((page - 1) * count)
      .take(count)
      .orderBy('ubl.createDate', 'DESC')
      .addOrderBy('pi.createDate', 'DESC')
      .getManyAndCount();

    const brandIds = userBrandLikeEntities.map((v) => v.brand.id);
    const counts = brandIds.length
      ? await this.userBrandLikeRepository
          .createQueryBuilder('ubl')
          .select('ubl.brandId', 'brandId')
          .addSelect('COUNT(*)', 'count')
          .where('ubl.brandId IN (:...brandIds)', { brandIds })
          .groupBy('ubl.brandId')
          .getRawMany<{ brandId: number; count: string }>()
      : [];

    const countMap = new Map(
      counts.map((c) => [Number(c.brandId), Number(c.count)]),
    );

    const result = userBrandLikeEntities.map((v) =>
      UserBrandLikeDto.from(v, countMap.get(v.brand.id) ?? 0),
    );

    return [result, total];
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InsertResult, Repository } from 'typeorm';

import { UserRecentEntity } from '../entity/user.recent.entity';

@Injectable()
export class UserRecentRepositoryService {
  constructor(
    @InjectRepository(UserRecentEntity)
    private readonly userRecentRepository: Repository<UserRecentEntity>,
  ) {}

  createBulk(userRecents: UserRecentEntity[]): Promise<InsertResult> {
    return this.userRecentRepository.upsert(userRecents, [
      'userId',
      'productItemId',
    ]);
  }

  async getList(
    userId: number,
    page: number,
    count: number,
    productCategoryId?: number,
  ): Promise<[UserRecentEntity[], number]> {
    const query = this.userRecentRepository.createQueryBuilder('ur');

    query
      .leftJoinAndSelect('ur.productItem', 'pi')
      .leftJoinAndSelect('pi.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .where('ur.userId = :userId', { userId });

    if (productCategoryId) {
      query.andWhere('p.product_category_id = :productCategoryId', {
        productCategoryId,
      });
    }

    return query
      .skip((page - 1) * count)
      .take(count)
      .orderBy('ur.updateDate', 'DESC')
      .getManyAndCount();
  }

  async getTopProductCategory(userId: number): Promise<number | null> {
    const result = await this.userRecentRepository
      .createQueryBuilder('ur')
      .select('pc.id', 'productCategoryId')
      .addSelect('count(1)', 'count')
      .leftJoin('ur.productItem', 'pi')
      .leftJoin('pi.product', 'p')
      .leftJoin('p.productCategory', 'pc')
      .where('ur.userId = :userId', { userId })
      .groupBy('pc.id')
      .orderBy('count', 'DESC')
      .getRawOne<{ productCategoryId: number; count: string }>();

    return result?.productCategoryId ?? null;
  }
}

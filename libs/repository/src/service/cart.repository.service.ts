import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';

import { CartItemEntity } from '../entity/cart-item.entity';

@Injectable()
export class CartRepositoryService {
  constructor(
    @InjectRepository(CartItemEntity)
    private readonly cartItemRepository: Repository<CartItemEntity>,
  ) {}

  /**
   * 장바구니 화면 한 줄을 그리는 데 필요한 것 전부를 한 번에 끌어온다.
   * 가격은 product_item, 재고는 product_variant, 브랜드는 product 를 두 단계
   * 거쳐야 나오고, 옵션 텍스트는 variant_option -> option_value 로 붙는다.
   */
  private buildDetailQuery(): SelectQueryBuilder<CartItemEntity> {
    return this.cartItemRepository
      .createQueryBuilder('ci')
      .leftJoinAndSelect('ci.productVariant', 'pv')
      .leftJoinAndSelect('pv.productItem', 'pi')
      .leftJoinAndSelect('pi.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('pv.variantOptions', 'vo')
      .leftJoinAndSelect('vo.optionValue', 'ov')
      .leftJoinAndSelect('ov.option', 'o');
  }

  async findDetailListByUserId(userId: number): Promise<CartItemEntity[]> {
    return this.buildDetailQuery()
      .where('ci.userId = :userId', { userId })
      .orderBy('ci.createDate', 'DESC')
      .addOrderBy('o.sortOrder', 'ASC')
      .getMany();
  }

  /** 주문서로 넘길 라인만 고른다. 남의 라인이 섞이지 않도록 userId 를 함께 건다 */
  async findDetailListByIds(
    userId: number,
    ids: number[],
  ): Promise<CartItemEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.buildDetailQuery()
      .where('ci.userId = :userId', { userId })
      .andWhere('ci.id IN (:...ids)', { ids })
      .orderBy('ci.createDate', 'DESC')
      .addOrderBy('o.sortOrder', 'ASC')
      .getMany();
  }

  async findByUserIdAndVariantId(
    userId: number,
    productVariantId: number,
  ): Promise<CartItemEntity | null> {
    return this.cartItemRepository.findOne({
      where: { userId, productVariantId },
    });
  }

  async findByIdAndUserId(
    id: number,
    userId: number,
  ): Promise<CartItemEntity | null> {
    return this.cartItemRepository.findOne({ where: { id, userId } });
  }

  /** 여러 SKU 를 한 번에 담을 때. 없는 것은 결과에서 빠진다 */
  async findByUserIdAndVariantIds(
    userId: number,
    productVariantIds: number[],
  ): Promise<CartItemEntity[]> {
    if (productVariantIds.length === 0) {
      return [];
    }

    return this.cartItemRepository.find({
      where: { userId, productVariantId: In(productVariantIds) },
    });
  }

  async save(entity: CartItemEntity): Promise<CartItemEntity> {
    return this.cartItemRepository.save(entity);
  }

  /** 트랜잭션 안에서 쓰인다. 하나라도 실패하면 전부 롤백된다 */
  async saveMany(entities: CartItemEntity[]): Promise<CartItemEntity[]> {
    return this.cartItemRepository.save(entities);
  }

  async countByUserId(userId: number): Promise<number> {
    return this.cartItemRepository.count({ where: { userId } });
  }

  /**
   * hard delete 다. soft delete 를 쓰면 삭제된 행이 (user_id, product_variant_id)
   * UNIQUE 제약에 남아 같은 상품을 다시 담을 수 없게 된다.
   */
  async deleteByIds(userId: number, ids: number[]) {
    if (ids.length === 0) {
      return;
    }

    return this.cartItemRepository.delete({ userId, id: In(ids) });
  }

  async deleteAllByUserId(userId: number) {
    return this.cartItemRepository.delete({ userId });
  }
}

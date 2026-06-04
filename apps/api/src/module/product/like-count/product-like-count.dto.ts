import { ProductLikeCountDto } from '@app/repository/dto/product.dto';

export class ProductLikeCountCollectionDto {
  private readonly countMap: Map<number, number>;

  private constructor(items: ProductLikeCountDto[]) {
    this.countMap = new Map(items.map((v) => [v.productItemId, v.count]));
  }

  static from(items: ProductLikeCountDto[]): ProductLikeCountCollectionDto {
    return new ProductLikeCountCollectionDto(items);
  }

  getCount(productItemId: number): number {
    return this.countMap.get(productItemId) ?? 0;
  }
}

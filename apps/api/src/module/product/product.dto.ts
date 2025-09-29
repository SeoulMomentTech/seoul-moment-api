import { DatabaseSort } from '@app/common/enum/global.enum';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductColorEntity } from '@app/repository/entity/product-color.entity';
import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import {
  OptionType,
  ProductSortColumn,
} from '@app/repository/enum/product.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetProductBannerResponse {
  @ApiProperty({
    description: '상품 배너',
    example: 'https://example.com/image1.jpg',
  })
  banner: string;

  static from(entity: ProductBannerEntity) {
    return plainToInstance(this, {
      banner: entity.getImage(),
    });
  }
}

export class GetProductCategoryResponse {
  @ApiProperty({
    description: 'id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 카테고리',
    example: '상의(kr), top(en), 上衣(zh)',
  })
  name: string;

  static from(
    entity: ProductCategoryEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const name = MultilingualFieldDto.fromByEntity(multilingualText, 'name');

    return plainToInstance(this, {
      id: entity.id,
      name: name.getContent(),
    });
  }
}

export class GetProductRequest {
  @ApiProperty({
    description: '현재 페이지',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  @Type(() => Number)
  page: number;

  @ApiProperty({
    description: '보여줄 item 갯수',
    example: 10,
  })
  @IsNumber()
  @IsDefined()
  @Type(() => Number)
  count: number;

  @ApiPropertyOptional({
    description: '정렬할 컬럼 이름',
    example: ProductSortColumn.CREATE,
    default: ProductSortColumn.CREATE,
    enum: ProductSortColumn,
  })
  @IsEnum(ProductSortColumn)
  @IsOptional()
  sortColum?: ProductSortColumn;

  @ApiPropertyOptional({
    description: '오름 차순(asc) 내림 차순(desc)',
    example: DatabaseSort.DESC,
    default: DatabaseSort.DESC,
    enum: DatabaseSort,
  })
  @IsEnum(DatabaseSort)
  @IsOptional()
  sort?: DatabaseSort;

  @ApiPropertyOptional({
    description: '검색어 상품이름',
    example: '홍길동',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: '브랜드 id',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  brandId: number;

  @ApiPropertyOptional({
    description: '카테고리 id',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  categoryId: number;

  @ApiPropertyOptional({
    description: '상품 카테고리 id',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  productCategoryId: number;

  static from(
    page: number,
    count: number,
    sortColum?: ProductSortColumn,
    sort?: DatabaseSort,
    search?: string,
    brandId?: number,
    categoryId?: number,
    productCategoryId?: number,
  ) {
    return plainToInstance(this, {
      page,
      count,
      sortColum,
      sort,
      search,
      brandId,
      categoryId,
      productCategoryId,
    });
  }

  isNotExistSort(): boolean {
    return !this.sortColum || !this.sort;
  }
}

export class GetProductResponse {
  @ApiProperty({
    description: '상품 id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '브랜드 이름',
    example: '51퍼센트',
  })
  brandName: string;

  @ApiProperty({
    description: '상품 이름',
    example: '51퍼센트',
  })
  productName: string;

  @ApiProperty({
    description: '가격 (할인 가격이 있으면 할인가격 보여줌)',
    example: 189000,
  })
  price: number;

  @ApiProperty({
    description: '좋아요 수',
    example: 54244,
  })
  like: number;

  @ApiProperty({
    description: '리뷰 수',
    example: 54244,
  })
  review: number;

  @ApiProperty({
    description: '별점 평균',
    example: 4.5,
  })
  reviewAverage: number;

  @ApiProperty({
    description: '상품이미지',
    example: 'https://image-dev.seoulmoment.com.tw/product/product_red_1.png',
  })
  image: string;

  static from(
    entity: ProductColorEntity,
    multilingualText: {
      brand: MultilingualTextEntity[];
      product: MultilingualTextEntity[];
    },
  ) {
    multilingualText.brand = multilingualText.brand.filter(
      (v) => v.entityId === entity.product.brand.id,
    );

    multilingualText.product = multilingualText.product.filter(
      (v) => v.entityId === entity.product.id,
    );

    const brandName = MultilingualFieldDto.fromByEntity(
      multilingualText.brand,
      'name',
    );
    const productName = MultilingualFieldDto.fromByEntity(
      multilingualText.product,
      'name',
    );

    return plainToInstance(this, {
      id: entity.id,
      brandName: brandName.getContent(),
      productName: productName.getContent(),
      price: entity.getEffectivePrice(),
      like: Math.floor(Math.random() * 50001),
      review: Math.floor(Math.random() * 10001),
      reviewAverage: Math.round(Math.random() * 5 * 10) / 10,
      image: entity.getMainImage(),
    });
  }
}

export class GetProductDetailOptionValue {
  @ApiProperty({
    description: '옵션값 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '옵션값',
    example: 'Red',
  })
  value: string;
}

export class GetProductDetailOption {
  @ApiProperty({
    description: '색상 옵션',
    type: [GetProductDetailOptionValue],
    required: false,
  })
  [OptionType.COLOR]?: GetProductDetailOptionValue[];

  @ApiProperty({
    description: '사이즈 옵션',
    type: [GetProductDetailOptionValue],
    required: false,
  })
  [OptionType.SIZE]?: GetProductDetailOptionValue[];

  @ApiProperty({
    description: '소재 옵션',
    type: [GetProductDetailOptionValue],
    required: false,
  })
  [OptionType.MATERIAL]?: GetProductDetailOptionValue[];

  @ApiProperty({
    description: '핏 옵션',
    type: [GetProductDetailOptionValue],
    required: false,
  })
  [OptionType.FIT]?: GetProductDetailOptionValue[];

  @ApiProperty({
    description: '스타일 옵션',
    type: [GetProductDetailOptionValue],
    required: false,
  })
  [OptionType.STYLE]?: GetProductDetailOptionValue[];

  static from(
    optionType: OptionType,
    valueList: GetProductDetailOptionValue[],
  ) {
    return plainToInstance(this, {
      [optionType]: valueList,
    });
  }
}

export class GetProductDetailBrand {
  @ApiProperty({
    description: '브랜드 프로필 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  profileImg: string;

  @ApiProperty({
    description: '브랜드 이름',
    example: '서울모먼트',
  })
  name: string;

  static from(profileImg: string, name: string) {
    return plainToInstance(this, {
      profileImg,
      name,
    });
  }
}

export class GetProductDetailResponse {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 이름',
    example: '오가닉 코튼 티셔츠',
  })
  name: string;

  @ApiProperty({
    description: '브랜드 정보',
    type: GetProductDetailBrand,
  })
  brand: GetProductDetailBrand;

  @ApiProperty({
    description: '정가',
    example: 259000,
  })
  price: number;

  @ApiProperty({
    description: '할인가',
    example: 189000,
  })
  discoountPrice: number;

  @ApiProperty({
    description: '원산지',
    example: '대한민국',
  })
  origin: string;

  @ApiProperty({
    description: '배송 정보 (일)',
    example: 3,
  })
  shippingInfo: number;

  @ApiProperty({
    description: '배송비',
    example: 3000,
  })
  shippingCost: number;

  @ApiProperty({
    description: '상품 옵션 목록',
    type: [GetProductDetailOption],
  })
  option: GetProductDetailOption[];

  @ApiProperty({
    description: '좋아요 수',
    example: 54244,
  })
  like: number;

  @ApiProperty({
    description: '리뷰 수',
    example: 54244,
  })
  review: number;

  @ApiProperty({
    description: '별점 평균',
    example: 4.5,
  })
  reviewAverage: number;

  @ApiProperty({
    description: '상품 상세 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/product/detail/product-detail-01.jpg',
  })
  detailImg: string;

  @ApiProperty({
    description: '서브 이미지 URL 목록',
    example: [
      'https://image-dev.seoulmoment.com.tw/product/sub/product-sub-01.jpg',
      'https://image-dev.seoulmoment.com.tw/product/sub/product-sub-02.jpg',
    ],
    type: [String],
  })
  subImage: string[];

  @ApiProperty({
    description: '연관 상품 목록',
    type: () => GetProductResponse,
    isArray: true,
    example: [
      {
        id: 1,
        brandName: '51퍼센트',
        productName: '오버핏 맨투맨',
        price: 189000,
        like: 3200,
        review: 150,
        reviewAverage: 4.3,
        image: 'https://image-dev.seoulmoment.com.tw/product/product_red_1.png',
      },
      {
        id: 2,
        brandName: 'ABC 브랜드',
        productName: '데님 팬츠',
        price: 99000,
        like: 2100,
        review: 88,
        reviewAverage: 4.6,
        image:
          'https://image-dev.seoulmoment.com.tw/product/product_blue_2.png',
      },
    ],
  })
  relate: GetProductResponse[];

  static from(
    entity: ProductColorEntity,
    multilingualText: {
      brand: MultilingualTextEntity[];
      product: MultilingualTextEntity[];
    },
    option: GetProductDetailOption[],
    relate: GetProductResponse[],
  ) {
    const name = MultilingualFieldDto.fromByEntity(
      multilingualText.product,
      'name',
    );

    const origin = MultilingualFieldDto.fromByEntity(
      multilingualText.product,
      'origin',
    );

    const brandName = MultilingualFieldDto.fromByEntity(
      multilingualText.brand,
      'name',
    );

    return plainToInstance(this, {
      id: entity.id,
      name: name.getContent(),
      brand: GetProductDetailBrand.from(
        entity.product.brand.getProfileImage(),
        brandName.getContent(),
      ),
      price: entity.price,
      discoountPrice: entity.discountPrice,
      origin: origin.getContent(),
      shippingInfo: entity.shippingInfo,
      shippingCost: entity.shippingCost,
      option,
      like: Math.floor(Math.random() * 50001),
      review: Math.floor(Math.random() * 10001),
      reviewAverage: Math.round(Math.random() * 5 * 10) / 10,
      detailImg: entity.product.getDetailInfoImage(),
      subImage: entity.images.map((v) => v.getImage()),
      relate,
    });
  }
}

export class PostProductCategoryInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '카테고리 이름',
    example: '상의',
  })
  @IsString()
  @IsDefined()
  name: string;
}

export class PostProductCategoryRequest {
  @ApiProperty({
    description: '카테고리 국가별 object list',
    type: [PostProductCategoryInfo],
    example: [
      {
        languageId: 1,
        name: '귀걸이',
      },
      {
        languageId: 2,
        name: 'Earrings',
      },
      {
        languageId: 3,
        name: '耳環',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostProductCategoryInfo)
  @IsDefined()
  list: PostProductCategoryInfo[];
}

export class GetProductCategoryRequest {
  @ApiProperty({
    description: '카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;
}

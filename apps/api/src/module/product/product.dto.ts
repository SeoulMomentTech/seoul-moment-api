import { DatabaseSort } from '@app/common/enum/global.enum';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { OptionValueEntity } from '@app/repository/entity/option-value.entity';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductFilterEntity } from '@app/repository/entity/product-filter.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import { VariantOptionEntity } from '@app/repository/entity/variant-option.entity';
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

export class ProductFilterDto {
  @ApiPropertyOptional({
    description: '성별 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  gender: number;

  @ApiPropertyOptional({
    description: '사이즈 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  size: number;

  @ApiPropertyOptional({
    description: '색상 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  color: number;

  @ApiPropertyOptional({
    description: '최소 가격',
    example: 10000,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  minPrice: number;

  @ApiPropertyOptional({
    description: '최대 가격',
    example: 100000,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  maxPrice: number;
}

export class GetProductBannerByBrandResponse {
  @ApiProperty({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandId: number;

  @ApiProperty({
    description: '배너 이미지',
    example: 'https://example.com/image1.jpg',
  })
  @IsString()
  @IsDefined()
  banner: string;

  @ApiProperty({
    description: '브랜드 이름',
    example: '브랜드 이름',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '브랜드 영문 이름',
    example: 'Brand Name',
  })
  @IsString()
  @IsDefined()
  englishName: string;

  @ApiProperty({
    description: '브랜드 설명',
    example: '브랜드 설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  @ApiProperty({
    description: '좋아요 수',
    example: 54244,
  })
  @IsNumber()
  @IsDefined()
  @Type(() => Number)
  like: number;

  static from(entity: BrandEntity, multilingualText: MultilingualTextEntity[]) {
    const name = MultilingualFieldDto.fromByEntity(multilingualText, 'name');
    const description = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'description',
    );

    return plainToInstance(this, {
      brandId: entity.id,
      banner: entity.getBannerImage(),
      name: name.getContent(),
      englishName: entity.englishName,
      description: description.getContent(),
      like: Math.floor(Math.random() * 50001),
    });
  }
}

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
    description: '상품 카테고리 이미지',
    example: 'https://example.com/image1.jpg',
  })
  image: string;

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
      image: entity.getImage(),
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
    description: '필터 정보',
    type: ProductFilterDto,
    example: {
      gender: 1,
      size: 1,
      color: 1,
      minPrice: 10000,
      maxPrice: 100000,
    },
  })
  @ValidateNested({ each: true })
  @Type(() => ProductFilterDto)
  @IsOptional()
  filter?: ProductFilterDto[];

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
    entity: ProductItemEntity,
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
    entity: ProductItemEntity,
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
  @ApiPropertyOptional({
    description: '카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  categoryId: number;
}
export class GetProductOptionResponse {
  @ApiProperty({
    description: 'option id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 옵션 타입',
    example: OptionType.COLOR,
    enum: OptionType,
  })
  type: OptionType;

  static from(entity: OptionEntity) {
    return plainToInstance(this, {
      id: entity.id,
      type: entity.type,
    });
  }
}

export class GetProductOptionValueRequest {
  @ApiProperty({
    description: 'option Id',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  optionId: number;
}

export class GetProductOptionValueResponse {
  @ApiProperty({
    description: 'option value id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'option 값',
    example: '빨강',
  })
  value: string;

  static from(
    entity: OptionValueEntity,
    multilingual: MultilingualTextEntity[],
  ) {
    const value = MultilingualFieldDto.fromByEntity(multilingual, 'value');

    return plainToInstance(this, {
      id: entity.id,
      value: value.getContent(),
    });
  }
}

export class PostProductLanguage {
  @ApiProperty({
    description: '국가 코드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  lenguageId: number;

  @ApiProperty({
    description: '상품 이름',
    example: '나이키 드라이핏 티셔츠',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '상품 원산지',
    example: '일본',
  })
  @IsString()
  @IsDefined()
  origin: string;
}

export class PostProductRequest {
  @ApiProperty({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandId: number;

  @ApiProperty({
    description: '카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;

  @ApiProperty({
    description: '상품 카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  productCategoryId: number;

  @ApiProperty({
    description: '삼품 상세 페이지 (원 이미지 상세 페이지)',
    example: '/product/product_detail_1.png',
  })
  @IsString()
  @IsDefined()
  detailInfoImageUrl: string;

  @ApiProperty({
    description: '국가별 글자',
    type: [PostProductLanguage],
    example: [
      {
        lenguageId: 1,
        name: '나이키 드라이핏 티셔츠',
        origin: '일본',
      },
      {
        lenguageId: 2,
        name: 'Nike Dri-FIT T-shirt',
        origin: 'USA',
      },
      {
        lenguageId: 3,
        name: '耐克 Dri-FIT T恤',
        origin: '中国',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostProductLanguage)
  text: PostProductLanguage[];
}

export class GetProductBannerRequest {
  @ApiProperty({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  brandId: number;
}

export class GetProductSortFilterResponse {
  @ApiProperty({
    description: '필터 아이디',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '필터 이름',
    example: '새로운 상품',
  })
  name: string;

  static from(
    entity: ProductFilterEntity,
    multilingual: MultilingualTextEntity[],
  ) {
    multilingual = multilingual.filter((v) => v.entityId === entity.id);

    const name = MultilingualFieldDto.fromByEntity(multilingual, 'name');
    return plainToInstance(this, {
      id: entity.id,
      name: name.getContent(),
    });
  }
}

export class ProductFilterGender {
  @ApiProperty({
    description: '성별 아이디',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '성별 이름',
    example: '남자',
  })
  name: string;

  static from(entity: VariantOptionEntity, value: string) {
    return plainToInstance(this, {
      id: entity.variantId,
      name: value,
    });
  }
}

export class ProductFilterSize {
  @ApiProperty({
    description: '사이즈 아이디',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '사이즈 이름',
    example: 'S(34)',
  })
  name: string;

  static from(entity: VariantOptionEntity, value: string) {
    return plainToInstance(this, {
      id: entity.variantId,
      name: value,
    });
  }
}

export class ProductFilterColor {
  @ApiProperty({
    description: '색상 아이디',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '색상 이름',
    example: '빨강',
  })
  name: string;

  @ApiProperty({
    description: '색상 코드',
    example: '#FF0000',
  })
  code: string;

  static from(entity: VariantOptionEntity, value: string) {
    return plainToInstance(this, {
      id: entity.variantId,
      name: value,
      code: entity.optionValue.colorCode,
    });
  }
}

export class GetProductFilterRequest {
  @ApiProperty({
    description: '카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;

  @ApiPropertyOptional({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  brandId?: number;

  @ApiPropertyOptional({
    description: '상품 카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  productCategoryId?: number;
}

export class GetProductFilterResponse {
  @ApiProperty({
    description: '필터 목록',
    type: [ProductFilterGender],
    example: [
      { id: 1, name: '남자' },
      { id: 2, name: '여자' },
    ],
  })
  gender: ProductFilterGender[];

  @ApiProperty({
    description: '사이즈 목록',
    type: [ProductFilterSize],
    example: [
      { id: 1, name: 'S(34)' },
      { id: 2, name: 'M(40)' },
      { id: 3, name: 'L(46)' },
    ],
  })
  size: ProductFilterSize[];

  @ApiProperty({
    description: '색상 목록',
    type: [ProductFilterColor],
    example: [
      { id: 1, name: '빨강', code: '#FF0000' },
      { id: 2, name: '파랑', code: '#0000FF' },
      { id: 3, name: '노랑', code: '#FFFF00' },
    ],
  })
  color: ProductFilterColor[];

  private static createMultilingualIndex(
    multilingual: MultilingualTextEntity[],
  ): Map<number, MultilingualTextEntity[]> {
    const index = new Map<number, MultilingualTextEntity[]>();
    for (const text of multilingual) {
      const existing = index.get(text.entityId);
      if (existing) {
        existing.push(text);
      } else {
        index.set(text.entityId, [text]);
      }
    }
    return index;
  }

  static from(
    entity: VariantOptionEntity[],
    multilingual: MultilingualTextEntity[],
  ) {
    // Create index once for O(1) lookup instead of O(n) filter per iteration
    const multilingualIndex = this.createMultilingualIndex(multilingual);

    // Use Map for efficient deduplication by name
    const genderMap = new Map<string, ProductFilterGender>();
    const sizeMap = new Map<string, ProductFilterSize>();
    const colorMap = new Map<string, ProductFilterColor>();

    for (const v of entity) {
      const multilingualTexts = multilingualIndex.get(v.optionValue.id) || [];
      const value = MultilingualFieldDto.fromByEntity(
        multilingualTexts,
        'value',
      );

      if (v.optionValue.option.type === OptionType.GENDER) {
        const name = value.getContent();
        if (!genderMap.has(name)) {
          const filterGender = ProductFilterGender.from(v, name);
          genderMap.set(name, filterGender);
        }
      } else if (v.optionValue.option.type === OptionType.SIZE) {
        const name = value.getContent();
        if (!sizeMap.has(name)) {
          const filterSize = ProductFilterSize.from(v, name);
          sizeMap.set(name, filterSize);
        }
      } else if (v.optionValue.option.type === OptionType.COLOR) {
        const name = value.getContent();
        if (!colorMap.has(name)) {
          const filterColor = ProductFilterColor.from(v, name);
          colorMap.set(name, filterColor);
        }
      }
    }

    return plainToInstance(this, {
      gender: Array.from(genderMap.values()),
      size: Array.from(sizeMap.values()),
      color: Array.from(colorMap.values()),
    });
  }

  static fromDistinct(data: {
    genders: Array<{ variantId: number; name: string }>;
    sizes: Array<{ variantId: number; name: string }>;
    colors: Array<{ variantId: number; name: string; code: string }>;
  }) {
    const genders = data.genders.map((item) =>
      plainToInstance(ProductFilterGender, {
        id: item.variantId,
        name: item.name,
      }),
    );

    const sizes = data.sizes.map((item) =>
      plainToInstance(ProductFilterSize, {
        id: item.variantId,
        name: item.name,
      }),
    );

    const colors = data.colors.map((item) =>
      plainToInstance(ProductFilterColor, {
        id: item.variantId,
        name: item.name,
        code: item.code,
      }),
    );

    return plainToInstance(this, {
      gender: genders,
      size: sizes,
      color: colors,
    });
  }
}

import { ProductEntity } from '@app/repository/entity/product.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  ProductSortColumn,
  ProductStatus,
} from '@app/repository/enum/product.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../admin.dto';

export class GetAdminProductRequest extends ListFilterDto {
  @ApiProperty({
    description: '정렬 컬럼',
    enum: ProductSortColumn,
    example: ProductSortColumn.CREATE,
  })
  @IsEnum(ProductSortColumn)
  @IsDefined()
  sortColumn: ProductSortColumn;
}

export class GetAdminProductNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '상품 이름',
    example: '나이키 드라이핏 티셔츠',
  })
  name: string;

  static from(languageCode: LanguageCode, name: string) {
    return plainToInstance(this, {
      languageCode,
      name,
    });
  }
}

export class GetAdminProductResponse {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '나이키 드라이핏 티셔츠',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Nike Dry-Fit T-Shirt',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '耐吉乾爽T恤',
      },
    ],
    type: [GetAdminProductNameDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminProductNameDto)
  nameDto: GetAdminProductNameDto[];

  static from(entity: ProductEntity, nameDto: GetAdminProductNameDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      nameDto,
    });
  }
}

export class PostAdminProductLanguage {
  @ApiProperty({
    description: '국가 코드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

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

export class PostAdminProductRequest {
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
    type: [PostAdminProductLanguage],
    example: [
      {
        languageId: 1,
        name: '나이키 드라이핏 티셔츠',
        origin: '일본',
      },
      {
        languageId: 2,
        name: 'Nike Dri-FIT T-shirt',
        origin: 'USA',
      },
      {
        languageId: 3,
        name: '耐克 Dri-FIT T恤',
        origin: '中国',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductLanguage)
  text: PostAdminProductLanguage[];
}

export class PatchAdminProductLanguage {
  @ApiProperty({
    description: '국가 코드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

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

export class PatchAdminProductRequest {
  @ApiPropertyOptional({
    description: '국가별 글자',
    type: [PatchAdminProductLanguage],
    example: [
      {
        languageId: 1,
        name: '나이키 드라이핏 티셔츠',
        origin: '일본',
      },
      {
        languageId: 3,
        name: '耐克 Dri-FIT T恤',
        origin: '中国',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminProductLanguage)
  @IsOptional()
  text?: PatchAdminProductLanguage[];

  @ApiPropertyOptional({
    description: '상품 상태',
    enum: ProductStatus,
    example: ProductStatus.NORMAL,
  })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: '브랜드 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  brandId?: number;

  @ApiPropertyOptional({
    description: '카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({
    description: '상품 카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  productCategoryId?: number;

  @ApiPropertyOptional({
    description: '상품 상세 페이지 (원 이미지 상세 페이지)',
    example:
      'https://image-dev.seoulmoment.com.tw/product/product_detail_1.png',
  })
  @IsString()
  @IsOptional()
  detailInfoImageUrl?: string;
}

export class GetAdminProductDetailResponse {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  id: number;

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
    description: '상품 상세 페이지 (원 이미지 상세 페이지)',
    example: '/product/product_detail_1.png',
  })
  @IsString()
  @IsDefined()
  detailInfoImageUrl: string;

  @ApiProperty({
    description: '상품 상태',
    enum: ProductStatus,
    example: ProductStatus.NORMAL,
  })
  @IsEnum(ProductStatus)
  @IsDefined()
  status: ProductStatus;

  @ApiProperty({
    description: '상품 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '나이키 드라이핏 티셔츠',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Nike Dry-Fit T-Shirt',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '耐吉乾爽T恤',
      },
    ],
    type: [GetAdminProductNameDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminProductNameDto)
  nameDto: GetAdminProductNameDto[];

  static from(entity: ProductEntity, nameDto: GetAdminProductNameDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      brandId: entity.brandId,
      categoryId: entity.categoryId,
      productCategoryId: entity.productCategoryId,
      detailInfoImageUrl: entity.detailInfoImageUrl,
      status: entity.status,
      nameDto,
    });
  }
}

import { BrandPromotionNoticeEntity } from '@app/repository/entity/brand-promotion-notice.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../../../admin.dto';

export class BrandPromotionNoticsLanguageDto {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '내용',
    example: '내용',
  })
  @IsString()
  @IsDefined()
  content: string;

  static from(multilingualText: MultilingualTextEntity) {
    return plainToInstance(this, {
      languageId: multilingualText.languageId,
      content: multilingualText.textContent,
    });
  }
}

export class PostAdminBrandPromotionNoticsRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [BrandPromotionNoticsLanguageDto],
    example: [
      {
        languageId: 1,
        content: '내용',
      },
      {
        languageId: 2,
        content: 'content',
      },
      {
        languageId: 3,
        content: '内容',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandPromotionNoticsLanguageDto)
  @IsDefined()
  language: BrandPromotionNoticsLanguageDto[];
}

export class GetAdminBrandPromotionNoticsListRequest extends ListFilterDto {}

export class GetAdminBrandPromotionNoticsResponse {
  @ApiProperty({
    description: '브랜드 프로모션 공지 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [BrandPromotionNoticsLanguageDto],
    example: [
      {
        languageId: 1,
        content: '내용',
      },
      {
        languageId: 2,
        content: 'content',
      },
      {
        languageId: 3,
        content: '内容',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandPromotionNoticsLanguageDto)
  @IsDefined()
  language: BrandPromotionNoticsLanguageDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: string;

  static from(
    entity: BrandPromotionNoticeEntity,
    multilingualTexts: BrandPromotionNoticsLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language: multilingualTexts,
      createDate: entity.createDate.toISOString(),
      updateDate: entity.updateDate.toISOString(),
    });
  }
}

export class GetAdminBrandPromotionNoticsDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 공지 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [BrandPromotionNoticsLanguageDto],
    example: [
      {
        languageId: 1,
        content: '내용',
      },
      {
        languageId: 2,
        content: 'content',
      },
      {
        languageId: 3,
        content: '内容',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandPromotionNoticsLanguageDto)
  @IsDefined()
  language: BrandPromotionNoticsLanguageDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: Date;

  static from(
    entity: BrandPromotionNoticeEntity,
    multilingualTexts: BrandPromotionNoticsLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language: multilingualTexts,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PatchAdminBrandPromotionNoticsRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '언어별 내용',
    type: [BrandPromotionNoticsLanguageDto],
    example: [
      {
        languageId: 1,
        content: '내용',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandPromotionNoticsLanguageDto)
  @IsDefined()
  language: BrandPromotionNoticsLanguageDto[];
}

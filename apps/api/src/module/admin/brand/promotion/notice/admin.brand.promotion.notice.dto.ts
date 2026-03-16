import { BrandPromotionNoticeEntity } from '@app/repository/entity/brand-promotion-notice.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../../../admin.dto';

export class PostAdminBrandPromotionNoticeLanguageDto {
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

  static from(languageId: number, content: string) {
    return plainToInstance(this, {
      languageId,
      content,
    });
  }
}

export class GetAdminBrandPromotionNoticeLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '내용',
    example: '내용',
  })
  @IsString()
  @IsDefined()
  content: string;

  static from(languageCode: LanguageCode, content: string) {
    return plainToInstance(this, {
      languageCode,
      content,
    });
  }
}

export class PostAdminBrandPromotionNoticeBaseDto {
  @ApiProperty({
    description: '언어별 내용',
    type: [PostAdminBrandPromotionNoticeLanguageDto],
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
  @Type(() => PostAdminBrandPromotionNoticeLanguageDto)
  @IsDefined()
  language: PostAdminBrandPromotionNoticeLanguageDto[];
}

export class PostAdminBrandPromotionNoticeRequest extends PostAdminBrandPromotionNoticeBaseDto {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;
}

export class GetAdminBrandPromotionNoticeListRequest extends ListFilterDto {}

export class GetAdminBrandPromotionNoticeResponse {
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
    type: [GetAdminBrandPromotionNoticeLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        content: '내용',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        content: 'content',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        content: '内容',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionNoticeLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionNoticeLanguageDto[];

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
    multilingualTexts: GetAdminBrandPromotionNoticeLanguageDto[],
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

export class GetAdminBrandPromotionNoticeDetailResponse {
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
    type: [GetAdminBrandPromotionNoticeLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        content: '내용',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        content: 'content',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        content: '内容',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionNoticeLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionNoticeLanguageDto[];

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
    multilingualTexts: GetAdminBrandPromotionNoticeLanguageDto[],
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

export class PatchAdminBrandPromotionNoticeRequest {
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
    type: [GetAdminBrandPromotionNoticeLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        content: '내용',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionNoticeLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionNoticeLanguageDto[];
}

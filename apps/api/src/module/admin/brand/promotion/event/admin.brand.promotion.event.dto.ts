import { BrandPromotionEventEntity } from '@app/repository/entity/brand-promotion-event.entity';
import { BrandPromotionEventStatus } from '@app/repository/enum/brand-promotion-event.enum';
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

export class PostAdminBrandPromotionEventLanguageDto {
  @ApiProperty({
    description: '언어 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  static from(languageId: number, title: string) {
    return plainToInstance(this, {
      languageId,
      title,
    });
  }
}

export class GetAdminBrandPromotionEventLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  static from(languageCode: LanguageCode, title: string) {
    return plainToInstance(this, {
      languageCode,
      title,
    });
  }
}

export class PostAdminBrandPromotionEventRequest {
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
    type: [PostAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageId: 1,
        title: '제목',
      },
      {
        languageId: 2,
        title: 'Title',
      },
      {
        languageId: 3,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: PostAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;
}

export class GetAdminBrandPromotionEventListRequest extends ListFilterDto {}

export class GetAdminBrandPromotionEventResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
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
    type: [GetAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Title',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;

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
    entity: BrandPromotionEventEntity,
    language: GetAdminBrandPromotionEventLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class GetAdminBrandPromotionEventDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 이벤트 아이디',
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
    type: [GetAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Title',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;

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
    entity: BrandPromotionEventEntity,
    language: GetAdminBrandPromotionEventLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PatchAdminBrandPromotionEventRequest {
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
    type: [GetAdminBrandPromotionEventLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Title',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '标题',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionEventLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionEventLanguageDto[];

  @ApiProperty({
    description: '상태',
    example: BrandPromotionEventStatus.NORMAL,
    enum: BrandPromotionEventStatus,
  })
  @IsEnum(BrandPromotionEventStatus)
  @IsDefined()
  status: BrandPromotionEventStatus;

  static from(
    entity: BrandPromotionEventEntity,
    language: GetAdminBrandPromotionEventLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      language,
      status: entity.status,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

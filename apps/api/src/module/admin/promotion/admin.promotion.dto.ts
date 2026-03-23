import { PromotionEntity } from '@app/repository/entity/promotion.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../admin.dto';

export class PostAdminPromotionLanguageDto {
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

  @ApiProperty({
    description: '설명',
    example: '설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  static from(languageId: number, title: string, description: string) {
    return plainToInstance(this, {
      languageId,
      title,
      description,
    });
  }
}

export class GetAdminPromotionLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @Type(() => Number)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '제목',
    example: '제목',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '설명',
    example: '설명',
  })
  @IsString()
  @IsDefined()
  description: string;

  static from(languageCode: LanguageCode, title: string, description: string) {
    return plainToInstance(this, {
      languageCode,
      title,
      description,
    });
  }
}

export class PostAdminPromotionRequest {
  @ApiProperty({
    description: '배너 이미지 경로',
    example: '/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerImagePath: string;

  @ApiProperty({
    description: '모바일 배너 이미지 경로',
    example: '/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerMobileImagePath: string;

  @ApiProperty({
    description: '썸네일 이미지 경로',
    example: '/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  thumbnailImagePath: string;

  @ApiProperty({
    description: '시작일 대만 시간 UTC (예: 2025-01-01 12:00:00)',
    example: '2025-01-01 12:00:00',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '종료일 대만 시간 UTC (예: 2025-09-16 23:59:59)',
    example: '2025-09-16 23:59:59',
  })
  @IsString()
  @IsDefined()
  endDate: string;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [PostAdminPromotionLanguageDto],
    example: [
      {
        languageId: 1,
        title: '제목',
        description: '설명',
      },
      {
        languageId: 2,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminPromotionLanguageDto)
  @IsDefined()
  language: PostAdminPromotionLanguageDto[];
}

export class GetAdminPromotionRequest extends ListFilterDto {}

export class GetAdminPromotionResponse {
  @ApiProperty({
    description: '프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '배너 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerImageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerMobileImageUrl: string;

  @ApiProperty({
    description: '썸네일 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  thumbnailImageUrl: string;

  @ApiProperty({
    description: '시작일',
    example: '2025-01-01',
  })
  @IsString()
  @IsDefined()
  startDate: Date;

  @ApiProperty({
    description: '종료일',
    example: '2025-09-16',
  })
  @IsString()
  @IsDefined()
  endDate: Date;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminPromotionLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '중국어 제목',
        description: '중국어 설명',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminPromotionLanguageDto)
  @IsDefined()
  language: GetAdminPromotionLanguageDto[];

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
    entity: PromotionEntity,
    language: GetAdminPromotionLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      bannerImageUrl: entity.getBannerImageUrl(),
      bannerMobileImageUrl: entity.getBannerMobileImageUrl(),
      thumbnailImageUrl: entity.getThumbnailImageUrl(),
      startDate: entity.startDate,
      endDate: entity.endDate,
      isActive: entity.isActive,
      language,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class GetAdminPromotionDetailResponse {
  @ApiProperty({
    description: '프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '배너 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerImageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerMobileImageUrl: string;

  @ApiProperty({
    description: '썸네일 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  thumbnailImageUrl: string;

  @ApiProperty({
    description: '시작일',
    example: '2025-01-01',
  })
  @IsString()
  @IsDefined()
  startDate: Date;

  @ApiProperty({
    description: '종료일',
    example: '2025-09-16',
  })
  @IsString()
  @IsDefined()
  endDate: Date;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminPromotionLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminPromotionLanguageDto)
  @IsDefined()
  language: GetAdminPromotionLanguageDto[];

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
    entity: PromotionEntity,
    language: GetAdminPromotionLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      bannerImageUrl: entity.getBannerImageUrl(),
      bannerMobileImageUrl: entity.getBannerMobileImageUrl(),
      thumbnailImageUrl: entity.getThumbnailImageUrl(),
      startDate: entity.startDate,
      endDate: entity.endDate,
      isActive: entity.isActive,
      language,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PatchAdminPromotionRequest {
  @ApiProperty({
    description: '배너 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerImageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  bannerMobileImageUrl: string;

  @ApiProperty({
    description: '썸네일 이미지 주소',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  @IsString()
  @IsDefined()
  thumbnailImageUrl: string;

  @ApiProperty({
    description: '시작일',
    example: '2025-01-01',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '종료일',
    example: '2025-09-16',
  })
  @IsString()
  @IsDefined()
  endDate: string;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminPromotionLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminPromotionLanguageDto)
  @IsDefined()
  language: GetAdminPromotionLanguageDto[];
}

export class GetAdminPromotionListRequest extends ListFilterDto {}

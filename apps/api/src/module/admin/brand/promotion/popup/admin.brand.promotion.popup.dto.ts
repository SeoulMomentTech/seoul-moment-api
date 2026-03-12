import { BrandPromotionPopupEntity } from '@app/repository/entity/brand-promotion-popup.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../../../admin.dto';

export class GetAdminBrandPromotionPopupLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '타이틀',
    example: 'TITLE',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '설명',
    example: 'DESCRIPTION',
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

export class PostAdminBrandPromotionPopupLanguageDto {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '타이틀',
    example: 'TITLE',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '설명',
    example: 'DESCRIPTION',
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
export class PostAdminBrandPromotionPopupBaseDto {
  @ApiProperty({
    description: '장소',
    example: '장소',
  })
  @IsString()
  @IsDefined()
  place: string;

  @ApiProperty({
    description: '주소',
    example: '주소',
  })
  @IsString()
  @IsDefined()
  address: string;

  @ApiProperty({
    description: '위도',
    example: 37.5665,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  latitude: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  longitude: number;

  @ApiProperty({
    description: '시작일',
    example: '2025-01-01',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '시작 시간',
    example: '10:00',
  })
  @IsString()
  @IsDefined()
  startTime: string;

  @ApiPropertyOptional({
    description: '종료일, null일 경우 상시 진행',
    example: '2025-03-01',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: '종료 시간',
    example: '20:00',
  })
  @IsString()
  @IsDefined()
  endTime: string;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [PostAdminBrandPromotionPopupLanguageDto],
    example: [
      {
        languageId: 1,
        title: '타이틀',
        description: '설명',
      },
      {
        languageId: 2,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
      {
        languageId: 3,
        title: '중국어 타이틀',
        description: '중국어 설명',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandPromotionPopupLanguageDto)
  @IsDefined()
  language: PostAdminBrandPromotionPopupLanguageDto[];

  @ApiProperty({
    description: '이미지 경로 리스트',
    example: [
      '/brand-promotion-popups/2025-09-16/popup-01.jpg',
      '/brand-promotion-popups/2025-09-16/popup-02.jpg',
      '/brand-promotion-popups/2025-09-16/popup-03.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imagePathList: string[];
}

export class PostAdminBrandPromotionPopupRequest extends PostAdminBrandPromotionPopupBaseDto {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;
}

export class GetAdminBrandPromotionPopupListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  brandPromotionId?: number;
}

export class GetAdminBrandPromotionPopupDetailResponse {
  @ApiProperty({
    description: '브랜드 프로모션 팝업 아이디',
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
    description: '장소',
    example: '장소',
  })
  @IsString()
  @IsDefined()
  place: string;

  @ApiProperty({
    description: '주소',
    example: '주소',
  })
  @IsString()
  @IsDefined()
  address: string;

  @ApiProperty({
    description: '위도',
    example: 37.5665,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  latitude: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  longitude: number;

  @ApiProperty({
    description: '시작일',
    example: '2025-01-01',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiPropertyOptional({
    description: '종료일, null일 경우 상시 진행',
    example: '2025-03-01',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionPopupLanguageDto],
    example: [
      {
        languageId: 1,
        title: '타이틀',
        description: '설명',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionPopupLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionPopupLanguageDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: string;

  @ApiProperty({
    description: '수정일',
    example: '2025-03-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: string;

  @ApiProperty({
    description: '이미지 경로 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-03.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];

  static from(
    entity: BrandPromotionPopupEntity,
    multilingualTexts: GetAdminBrandPromotionPopupLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      place: entity.place,
      address: entity.address,
      latitude: entity.latitude,
      longitude: entity.longitude,
      startDate: entity.startDate,
      endDate: entity.endDate,
      startTime: entity.startTime,
      endTime: entity.endTime,
      isActive: entity.isActive,
      language: multilingualTexts,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
      imageUrlList: entity.images.map((image) => image.getImageUrl()),
    });
  }
}

export class GetAdminBrandPromotionPopupResponse {
  @ApiProperty({
    description: '브랜드 프로모션 팝업 아이디',
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
    description: '장소',
    example: '장소',
  })
  @IsString()
  @IsDefined()
  place: string;

  @ApiProperty({
    description: '주소',
    example: '주소',
  })
  @IsString()
  @IsDefined()
  address: string;

  @ApiProperty({
    description: '위도',
    example: '위도',
  })
  @IsString()
  @IsDefined()
  latitude: string;

  @ApiProperty({
    description: '경도',
    example: '경도',
  })
  @IsString()
  @IsDefined()
  longitude: string;

  @ApiProperty({
    description: '시작일',
    example: '시작일',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '시작 시간',
    example: '10:00',
  })
  @IsString()
  @IsDefined()
  startTime: string;

  @ApiPropertyOptional({
    description: '종료일, null일 경우 상시 진행',
    example: '2025-03-01',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: '종료 시간',
    example: '20:00',
  })
  @IsString()
  @IsDefined()
  endTime: string;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionPopupLanguageDto],
    example: [
      {
        languageId: 1,
        title: '타이틀',
        description: '설명',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionPopupLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionPopupLanguageDto[];

  @ApiProperty({
    description: '생성일',
  })
  @IsString()
  @IsDefined()
  createDate: string;

  @ApiProperty({
    description: '수정일',
    example: '수정일',
  })
  @IsString()
  @IsDefined()
  updateDate: string;

  @ApiProperty({
    description: '이미지 경로 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-03.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];

  static from(
    entity: BrandPromotionPopupEntity,
    multilingualTexts: GetAdminBrandPromotionPopupLanguageDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      brandPromotionId: entity.brandPromotionId,
      place: entity.place,
      address: entity.address,
      latitude: entity.latitude,
      longitude: entity.longitude,
      startDate: entity.startDate,
      endDate: entity.endDate,
      startTime: entity.startTime,
      endTime: entity.endTime,
      isActive: entity.isActive,
      language: multilingualTexts,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
      imageUrlList: entity.images.map((image) => image.getImageUrl()),
    });
  }
}

export class PatchAdminBrandPromotionPopupRequest {
  @ApiProperty({
    description: '브랜드 프로모션 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  brandPromotionId: number;

  @ApiProperty({
    description: '장소',
    example: '장소',
  })
  @IsString()
  @IsDefined()
  place: string;

  @ApiProperty({
    description: '주소',
    example: '주소',
  })
  @IsString()
  @IsDefined()
  address: string;

  @ApiProperty({
    description: '위도',
    example: 37.5665,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  latitude: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  longitude: number;

  @ApiProperty({
    description: '시작일',
    example: '2025-01-01',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '시작 시간',
    example: '10:00',
  })
  @IsString()
  @IsDefined()
  startTime: string;

  @ApiPropertyOptional({
    description: '종료일, null일 경우 상시 진행',
    example: '2025-03-01',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: '종료 시간',
    example: '20:00',
  })
  @IsString()
  @IsDefined()
  endTime: string;

  @ApiProperty({
    description: '활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  isActive: boolean;

  @ApiProperty({
    description: '언어별 내용',
    type: [GetAdminBrandPromotionPopupLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '타이틀',
        description: '설명',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'TITLE',
        description: 'DESCRIPTION',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '중국어 타이틀',
        description: '중국어 설명',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminBrandPromotionPopupLanguageDto)
  @IsDefined()
  language: GetAdminBrandPromotionPopupLanguageDto[];

  @ApiProperty({
    description: '이미지 경로 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-promotion-popups/2025-09-16/popup-03.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];
}

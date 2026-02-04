import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import {
  PlanSchedulePayType,
  PlanScheduleSortColumn,
  PlanScheduleStatus,
} from '@app/repository/enum/plan-schedule.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { ListFilterDto } from '../../admin/admin.dto';

export class PostPlanScheduleRequest {
  @ApiProperty({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  categoryName: string;

  @ApiPropertyOptional({
    description: '추가 카테고리 이름 리스트',
    example: ['저녁 식사', '저녁 식사'],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  addCategoryNameList?: string[];

  @ApiProperty({
    description: '제목',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '결제 타입',
    example: 'CREDIT',
    enum: PlanSchedulePayType,
  })
  @IsEnum(PlanSchedulePayType)
  @IsDefined()
  payType: PlanSchedulePayType;

  @ApiProperty({
    description: '금액',
    example: 10000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  amount: number;

  @ApiPropertyOptional({
    description: '시작 날짜',
    example: '2025-02-24',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: '위치',
    example: '서울시 강남구 역삼동',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: '위도 (-90 ~ 90)',
    example: 37.5665,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  locationLat?: number;

  @ApiPropertyOptional({
    description: '경도 (-180 ~ 180)',
    example: 127.036344,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  locationLng?: number;

  @ApiPropertyOptional({
    description: '메모',
    example: '저녁 식사 장소',
  })
  @IsString()
  @IsOptional()
  memo?: string;
}

export class PostPlanScheduleResponse {
  @ApiProperty({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  categoryName: string;

  @ApiProperty({
    description: '제목',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '결제 타입',
    example: 'CREDIT',
    enum: PlanSchedulePayType,
  })
  @IsEnum(PlanSchedulePayType)
  @IsDefined()
  payType: PlanSchedulePayType;

  @ApiProperty({
    description: '금액',
    example: 10000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  amount: number;

  @ApiProperty({
    description: '시작 날짜',
    example: '2025-02-24',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '위치',
    example: '서울시 강남구 역삼동',
  })
  @IsString()
  @IsDefined()
  location: string;

  @ApiProperty({
    description: '위도',
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  locationLat: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  locationLng: number;

  @ApiProperty({
    description: '메모',
    example: '저녁 식사 장소',
  })
  @IsString()
  @IsDefined()
  memo: string;

  static from(entity: PlanScheduleEntity) {
    return plainToInstance(this, {
      categoryName: entity.categoryName,
      title: entity.title,
      payType: entity.payType,
      amount: entity.amount,
      startDate: entity.startDate,
      location: entity.location,
      locationLat: entity.locationLat,
      locationLng: entity.locationLng,
      memo: entity.memo,
    });
  }
}

export class GetPlanScheduleResponse {
  @ApiProperty({
    description: 'ID',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  categoryName: string;

  @ApiProperty({
    description: '제목',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '금액',
    example: 10000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  amount: number;

  @ApiProperty({
    description: '시작 날짜',
    example: '2025-02-24',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '상태',
    example: PlanScheduleStatus.NORMAL,
    enum: PlanScheduleStatus,
  })
  @IsEnum(PlanScheduleStatus)
  @IsDefined()
  status: PlanScheduleStatus;

  static from(entity: PlanScheduleEntity) {
    return plainToInstance(this, {
      id: entity.id,
      categoryName: entity.categoryName,
      title: entity.title,
      amount: entity.amount,
      startDate: entity.startDate,
      status: entity.status,
    });
  }
}

export class GetPlanScheduleListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '검색 칼럼',
    example: PlanScheduleSortColumn.START_DATE,
    enum: PlanScheduleSortColumn,
  })
  @IsOptional()
  @IsEnum(PlanScheduleSortColumn)
  sortColumn?: PlanScheduleSortColumn;

  @ApiPropertyOptional({
    description: '상태',
    example: PlanScheduleStatus.NORMAL,
    enum: PlanScheduleStatus,
  })
  @IsOptional()
  @IsEnum(PlanScheduleStatus)
  status?: PlanScheduleStatus;

  @ApiPropertyOptional({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsOptional()
  @IsString()
  categoryName?: string;
}

export class GetPlanUserTotalAmountResponse {
  @ApiProperty({
    description: '총 금액',
    example: 10000,
  })
  totalAmount: number;

  static from(totalAmount: number) {
    return plainToInstance(this, {
      totalAmount,
    });
  }
}

export class GetPlanScheduleDetailResponse {
  @ApiProperty({
    description: 'ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '카테고리 이름',
  })
  categoryName: string;

  @ApiProperty({
    description: '제목',
    example: '저녁 식사',
  })
  title: string;

  @ApiProperty({
    description: '금액',
    example: 10000,
  })
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: '시작 날짜',
    example: '2025-02-24',
  })
  startDate: string;

  @ApiProperty({
    description: '위치',
    example: '서울시 강남구 역삼동',
  })
  location: string;

  @ApiProperty({
    description: '위도',
    example: 37.5665,
  })
  locationLat: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
  locationLng: number;

  @ApiProperty({
    description: '메모',
    example: '저녁 식사 장소',
  })
  memo: string;

  @ApiProperty({
    description: '결제 타입',
    example: 'CREDIT',
    enum: PlanSchedulePayType,
  })
  payType: PlanSchedulePayType;

  @ApiProperty({
    description: '상태',
    example: PlanScheduleStatus.NORMAL,
    enum: PlanScheduleStatus,
  })
  status: PlanScheduleStatus;

  static from(entity: PlanScheduleEntity) {
    return plainToInstance(this, {
      id: entity.id,
      categoryName: entity.categoryName,
      title: entity.title,
      amount: entity.amount,
      startDate: entity.startDate,
      location: entity.location,
      locationLat: entity.locationLat,
      locationLng: entity.locationLng,
      memo: entity.memo,
      payType: entity.payType,
      status: entity.status,
    });
  }
}

export class PatchPlanScheduleRequest {
  @ApiProperty({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  categoryName: string;

  @ApiPropertyOptional({
    description: '추가 카테고리 이름 리스트',
    example: ['저녁 식사', '저녁 식사'],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  addCategoryNameList?: string[];

  @ApiProperty({
    description: '제목',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '결제 타입',
    example: 'CREDIT',
    enum: PlanSchedulePayType,
  })
  @IsEnum(PlanSchedulePayType)
  @IsDefined()
  payType: PlanSchedulePayType;

  @ApiProperty({
    description: '금액',
    example: 10000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  amount: number;

  @ApiPropertyOptional({
    description: '시작 날짜',
    example: '2025-02-24',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: '위치',
    example: '서울시 강남구 역삼동',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: '위도 (-90 ~ 90)',
    example: 37.5665,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  locationLat?: number;

  @ApiPropertyOptional({
    description: '경도 (-180 ~ 180)',
    example: 127.036344,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  locationLng?: number;

  @ApiPropertyOptional({
    description: '메모',
    example: '저녁 식사 장소',
  })
  @IsString()
  @IsOptional()
  memo?: string;
}

export class PatchPlanScheduleResponse {
  @ApiProperty({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  categoryName: string;

  @ApiProperty({
    description: '제목',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '결제 타입',
    example: 'CREDIT',
    enum: PlanSchedulePayType,
  })
  @IsEnum(PlanSchedulePayType)
  @IsDefined()
  payType: PlanSchedulePayType;

  @ApiProperty({
    description: '금액',
    example: 10000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  amount: number;

  @ApiProperty({
    description: '시작 날짜',
    example: '2025-02-24',
  })
  @IsString()
  @IsDefined()
  startDate: string;

  @ApiProperty({
    description: '위치',
    example: '서울시 강남구 역삼동',
  })
  @IsString()
  @IsDefined()
  location: string;

  @ApiProperty({
    description: '위도',
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  locationLat: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
  @Type(() => Number)
  @IsNumber()
  @IsDefined()
  locationLng: number;

  @ApiProperty({
    description: '메모',
    example: '저녁 식사 장소',
  })
  @IsString()
  @IsDefined()
  memo: string;

  static from(entity: PlanScheduleEntity) {
    return plainToInstance(this, {
      categoryName: entity.categoryName,
      title: entity.title,
      payType: entity.payType,
      amount: entity.amount,
      startDate: entity.startDate,
      location: entity.location,
      locationLat: entity.locationLat,
      locationLng: entity.locationLng,
      memo: entity.memo,
    });
  }
}

export class PatchPlanScheduleStatusRequest {
  @ApiProperty({
    description: '상태',
    example: PlanScheduleStatus.NORMAL,
    enum: PlanScheduleStatus,
  })
  @IsEnum(PlanScheduleStatus)
  @IsDefined()
  status: PlanScheduleStatus;
}

export class PatchPlanScheduleStatusResponse {
  @ApiProperty({
    description: 'ID',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '상태',
    example: PlanScheduleStatus.NORMAL,
    enum: PlanScheduleStatus,
  })
  @IsEnum(PlanScheduleStatus)
  @IsDefined()
  status: PlanScheduleStatus;

  static from(entity: PlanScheduleEntity) {
    return plainToInstance(this, {
      id: entity.id,
      status: entity.status,
    });
  }
}

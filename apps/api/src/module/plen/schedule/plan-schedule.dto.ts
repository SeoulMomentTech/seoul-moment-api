import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import { PlanSchedulePayType } from '@app/repository/enum/plan-schedule.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsString,
} from 'class-validator';

export class PostPlanScheduleRequest {
  @ApiProperty({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsString()
  @IsDefined()
  categoryName: string;

  @ApiProperty({
    description: '추가 카테고리 이름 리스트',
    example: ['저녁 식사', '저녁 식사'],
  })
  @IsArray()
  @IsDefined()
  @IsString({ each: true })
  addCategoryNameList: string[];

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
  @IsNumber()
  @IsDefined()
  locationLat: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
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
  @IsNumber()
  @IsDefined()
  locationLat: number;

  @ApiProperty({
    description: '경도',
    example: 127.036344,
  })
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

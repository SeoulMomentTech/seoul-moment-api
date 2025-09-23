import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import moment from 'moment-timezone';

export class PagingDto {
  @ApiProperty({
    description: '현재 페이지 번호',
    example: 1
  })
  page: number;

  @ApiProperty({
    description: '페이지당 항목 수',
    example: 10
  })
  count: number;

  static from(page: number, count: number): PagingDto {
    return plainToInstance(this, { page, count });
  }

  getOffset(): number {
    return (this.page - 1) * this.count;
  }
}

export class CalendarDto {
  @ApiProperty({
    description: '시작 날짜 format(YYYY-MM-DD)',
    example: '2025-02-24',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({
    description: '끝 날짜 format(YYYY-MM-DD)',
    example: '2025-02-27',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  constructor() {}

  static from(startDate: string, endDate: string): CalendarDto {
    return plainToInstance(this, { startDate, endDate });
  }

  isEmpty(): boolean {
    if (this.startDate && this.endDate) return false;
    return true;
  }

  getStartDateFullTime(): string {
    return `${this.startDate} 23:59:59`;
  }

  getEndDateFullTime(): string {
    return `${this.endDate} 23:59:59`;
  }
}

export class DateChartDto {
  @ApiProperty({
    description: '날짜 (YYYY-MM-DD 형식)',
    example: '2025-09-16'
  })
  date: string;

  @ApiProperty({
    description: '해당 날짜의 카운트',
    example: 5
  })
  count: number;

  static from(date: Date, count: number): DateChartDto {
    return plainToInstance(this, {
      date: moment(date).format('YYYY-MM-DD'),
      count,
    });
  }
}

export class DetailChart {
  @ApiProperty({
    description: '차트 데이터 배열',
    type: [DateChartDto]
  })
  chart: DateChartDto[];

  @ApiProperty({
    description: '총 카운트',
    example: 150
  })
  count: number;
}

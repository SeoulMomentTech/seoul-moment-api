import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import moment from 'moment-timezone';

export class PagingDto {
  page: number;
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
  date: string;
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
    description: '차트',
  })
  chart: DateChartDto[];
  count: number;
}

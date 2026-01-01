import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum PeriodType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class AnalyticsRequestDto {
  @ApiProperty({
    description: 'Period type for analytics',
    enum: PeriodType,
    example: 'monthly',
    required: true,
  })
  @IsEnum(PeriodType)
  period: PeriodType;

  @ApiProperty({
    description: 'Limit number of data points. Overrides default limit per period type. Default: daily=30, weekly=12, monthly=12, yearly=all',
    required: false,
    minimum: 1,
    maximum: 365,
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  limit?: number;

  @ApiProperty({
    description: 'Start date for custom range (YYYY-MM-DD format). If provided, endDate must also be provided.',
    required: false,
    example: '2025-12-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for custom range (YYYY-MM-DD format). If provided, startDate must also be provided.',
    required: false,
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

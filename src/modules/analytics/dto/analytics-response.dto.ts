import { ApiProperty } from '@nestjs/swagger';

export class GrowthDataPoint {
  @ApiProperty({
    description: 'Label for the data point (e.g., date, week range, month, year)',
    example: 'Jan 2026',
  })
  label: string;

  @ApiProperty({
    description: 'Number of new items created in this period',
    example: 5,
  })
  value: number;
}

export class DateRangeDto {
  @ApiProperty({
    description: 'Start date of the data range',
    example: '2025-01-01',
  })
  start: string;

  @ApiProperty({
    description: 'End date of the data range',
    example: '2025-12-31',
  })
  end: string;
}

export class GrowthAnalyticsResponseDto {
  @ApiProperty({
    description: 'Period type used for this analytics',
    example: 'monthly',
  })
  period: string;

  @ApiProperty({
    description: 'Total count of items in the result',
    example: 48,
  })
  total: number;

  @ApiProperty({
    description: 'Number of data points returned',
    example: 12,
  })
  dataPoints: number;

  @ApiProperty({
    description: 'Applied limit (default or custom)',
    example: 12,
  })
  appliedLimit: number;

  @ApiProperty({
    description: 'Date range of the data',
    type: DateRangeDto,
  })
  dateRange: DateRangeDto;

  @ApiProperty({
    description: 'Growth data points sorted chronologically',
    type: [GrowthDataPoint],
  })
  data: GrowthDataPoint[];
}

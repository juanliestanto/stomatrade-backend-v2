import { ApiProperty } from '@nestjs/swagger';

export class ProjectDetailResponseDto {
  @ApiProperty({
    description: 'Project volume',
    example: 5000,
  })
  volume: number;

  @ApiProperty({
    description: 'Commodity type',
    example: 'Rice',
  })
  commodity: string;

  @ApiProperty({
    description: 'Project submission date',
    example: '2025-12-10T10:30:00.000Z',
  })
  submissionDate: Date;

  @ApiProperty({
    description: 'Expected delivery date',
    example: '2026-03-15T10:30:00.000Z',
  })
  deliveryDate: Date;

  @ApiProperty({
    description: 'Total project value (in IDRX wei)',
    example: '150000000000000000000000',
  })
  projectPrice: string;

  @ApiProperty({
    description: 'Maximum crowdfunding target (in IDRX wei)',
    example: '100000000000000000000000',
  })
  fundingPrice: string;

  @ApiProperty({
    description: 'Current total funding collected (in IDRX wei)',
    example: '75000000000000000000000',
  })
  currentFundingPrice: string;

  @ApiProperty({
    description: 'Return on investment rate percentage',
    example: 25,
    nullable: true,
  })
  returnInvestmentRate: number | null;

  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  projectId: string;

  @ApiProperty({
    description: 'Project name',
    example: 'Rice Premium Grade A Harvest 2026',
  })
  projectName: string;

  @ApiProperty({
    description: 'Collector/Company name',
    example: 'PT Pertanian Sejahtera',
  })
  collectorName: string;

  @ApiProperty({
    description: 'Farmer name',
    example: 'Budi Santoso',
  })
  farmerName: string;

  @ApiProperty({
    description: 'Number of unique investors',
    example: 12,
  })
  totalInvestors: number;

  @ApiProperty({
    description: 'Project status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'SUCCESS', 'REFUNDING', 'CLOSED'],
  })
  status: string;

  @ApiProperty({
    description: 'Funding percentage',
    example: 75,
  })
  fundingPercentage: number;

  @ApiProperty({
    description: 'Project image URL',
    example: 'https://storage.example.com/projects/rice-field.jpg',
    nullable: true,
  })
  image: string | null;

  @ApiProperty({
    description: 'Land address',
    example: 'Jl. Raya Pertanian No. 123, Bogor',
  })
  landAddress: string;

  @ApiProperty({
    description: 'Grade quality',
    example: 'A',
    nullable: true,
  })
  gradeQuality: string | null;
}

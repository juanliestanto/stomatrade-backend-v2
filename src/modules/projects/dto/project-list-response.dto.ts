import { ApiProperty } from '@nestjs/swagger';

export class ProjectListItemDto {
  @ApiProperty({
    description: 'Project name (commodity)',
    example: 'Rice Premium Grade A',
  })
  projectName: string;

  @ApiProperty({
    description: 'Collector/Company name',
    example: 'PT Pertanian Sejahtera',
  })
  projectCompany: string;

  @ApiProperty({
    description: 'Total funding collected so far (in IDRX wei)',
    example: '50000000000000000000000',
  })
  totalFunding: string;

  @ApiProperty({
    description: 'Maximum crowdfunding target (in IDRX wei)',
    example: '100000000000000000000000',
  })
  fundingPrice: string;

  @ApiProperty({
    description: 'Number of unique investors',
    example: 15,
  })
  investors: number;

  @ApiProperty({
    description: 'Profit margin percentage',
    example: 25,
    nullable: true,
  })
  margin: number | null;

  @ApiProperty({
    description: 'Project image URL',
    example: 'https://storage.example.com/projects/rice-field.jpg',
    nullable: true,
  })
  image: string | null;

  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  projectId: string;

  @ApiProperty({
    description: 'Project status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'SUCCESS', 'REFUNDING', 'CLOSED'],
  })
  status: string;

  @ApiProperty({
    description: 'Funding percentage (totalFunding / fundingPrice * 100)',
    example: 50,
  })
  fundingPercentage: number;
}

export class ProjectListResponseDto {
  @ApiProperty({
    description: 'List of ongoing projects',
    type: [ProjectListItemDto],
  })
  items: ProjectListItemDto[];

  @ApiProperty({
    description: 'Total number of ongoing projects',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total pages',
    example: 3,
  })
  totalPages: number;
}

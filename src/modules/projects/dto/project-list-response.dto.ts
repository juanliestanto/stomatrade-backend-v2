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

  @ApiProperty({
    description: 'Blockchain NFT token ID',
    example: 4,
    nullable: true,
  })
  tokenId?: number | null;

  @ApiProperty({
    description: 'Chain ID in CAIP-2 format',
    example: 'eip155:4202',
    nullable: true,
  })
  chainId?: string | null;

  @ApiProperty({
    description: 'Smart contract address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nullable: true,
  })
  contractAddress?: string | null;

  @ApiProperty({
    description: 'Block explorer NFT URL',
    example: 'https://sepolia-blockscout.lisk.com/nft/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb/4',
    nullable: true,
  })
  explorerNftUrl?: string | null;
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

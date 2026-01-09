import { ApiProperty } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty({example: 'cc0e8400-e29b-41d4-a716-446655440007',})
  id: string;

  @ApiProperty({example: 3001,
    nullable: true,})
  tokenId: number | null;

  @ApiProperty({
    description: 'Chain ID in CAIP-2 format',
    example: 'eip155:5001',
    nullable: true,
  })
  chainId?: string | null;

  @ApiProperty({
    description: 'Smart contract address',
    example: '0x08A2cefa99A8848cD3aC34620f49F115587dcE28',
    nullable: true,
  })
  contractAddress?: string | null;

  @ApiProperty({
    description: 'Block explorer NFT URL',
    example: 'https://sepolia.mantlescan.xyz/nft/0x08A2cefa99A8848cD3aC34620f49F115587dcE28/4',
    nullable: true,
  })
  explorerNftUrl?: string | null;

  @ApiProperty({example: '550e8400-e29b-41d4-a716-446655440000',})
  collectorId: string;

  @ApiProperty({example: '770e8400-e29b-41d4-a716-446655440002',})
  farmerId: string;

  @ApiProperty({example: '880e8400-e29b-41d4-a716-446655440003',})
  landId: string;

  @ApiProperty({example: 'Coffee Arabica Q1 Harvest',})
  name: string;

  @ApiProperty({example: 'Rice',})
  commodity: string;

  @ApiProperty({example: 1000.5,})
  volume: number;

  @ApiProperty({example: 18,})
  volumeDecimal: number;

  @ApiProperty({example: 20,
    nullable: true,})
  profitShare: number | null;

  @ApiProperty({example: '2025-02-15T08:00:00.000Z',})
  sendDate: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({example: false,})
  deleted: boolean;
}

export class ProjectWithRelationsDto extends ProjectResponseDto {
  @ApiProperty()
  farmer?: any;

  @ApiProperty()
  land?: any;

  @ApiProperty()
  projectSubmission?: any;

  @ApiProperty({type: 'array',})
  investments?: any[];

  @ApiProperty()
  profitPool?: any;
}

export class PaginatedProjectResponseDto {
  @ApiProperty({type: [ProjectResponseDto],})
  items: ProjectResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

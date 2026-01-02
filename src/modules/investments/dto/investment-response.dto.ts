import { ApiProperty } from '@nestjs/swagger';

/**
 * Project information nested in investment response
 */
export class ProjectInfo {
  @ApiProperty({
    example: 'project-uuid-1',
    description: 'Project ID',
  })
  id: string;

  @ApiProperty({
    example: 'Rice',
    description: 'Commodity type',
  })
  commodity: string;

  @ApiProperty({
    example: 'Pak Budi',
    description: 'Farmer name',
  })
  farmerName: string;

  @ApiProperty({
    example: '1000',
    description: 'Target volume',
  })
  targetAmount: string;
}

/**
 * Investment data structure
 */
export class InvestmentData {
  @ApiProperty({
    example: 'inv-uuid-123',
    description: 'Investment unique identifier',
  })
  id: string;

  @ApiProperty({
    example: '10000',
    description: 'Investment amount (clean value)',
  })
  amount: string;

  @ApiProperty({
    example: 4001,
    description: 'Receipt NFT token ID',
  })
  receiptTokenId: number;

  @ApiProperty({
    example: 'Investment Successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    example: '2026-01-02T10:30:00.000Z',
    description: 'Investment timestamp',
  })
  investedAt: Date;

  @ApiProperty({
    type: () => ProjectInfo,
    description: 'Minimal project information',
  })
  project: ProjectInfo;
}

/**
 * Response DTO for creating investment
 */
export class InvestmentResponseDto {
  @ApiProperty({
    type: InvestmentData,
    description: 'Investment data with receipt NFT',
  })
  data: InvestmentData;
}

/**
 * Investment detail data with profit claims
 */
export class InvestmentDetailData extends InvestmentData {
  @ApiProperty({
    example: [
      {
        id: 'claim-uuid-1',
        amount: '1000',
        claimedAt: '2026-01-15T08:00:00.000Z',
      },
    ],
    description: 'Profit claims history',
  })
  profitClaims: Array<{
    id: string;
    amount: string;
    claimedAt: Date;
  }>;
}

/**
 * Response DTO for getting investment details
 * Includes more information than creation response
 */
export class InvestmentDetailResponseDto {
  @ApiProperty({
    example: 'Investment Retrieved Successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    description: 'Investment details with profit claims',
  })
  data: InvestmentDetailData;
}

/**
 * Response DTO for list of investments
 */
export class InvestmentListResponseDto {
  @ApiProperty({
    example: 'Investments Retrieved Successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    example: 15,
    description: 'Total number of investments',
  })
  total: number;

  @ApiProperty({
    type: [InvestmentData],
    description: 'Array of investments',
  })
  data: InvestmentData[];
}

/**
 * Response DTO for project statistics
 */
export class ProjectStatsResponseDto {
  @ApiProperty({
    example: 'Project Statistics Retrieved Successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    example: {
      projectId: 'project-uuid-1',
      totalInvestments: 15,
      totalInvested: '150000',
      uniqueInvestors: 8,
      averageInvestment: '10000',
    },
    description: 'Project investment statistics',
  })
  data: {
    projectId: string;
    totalInvestments: number;
    totalInvested: string;
    uniqueInvestors: number;
    averageInvestment: string;
  };
}

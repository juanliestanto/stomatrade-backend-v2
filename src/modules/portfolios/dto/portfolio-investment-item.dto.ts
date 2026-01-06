import { ApiProperty } from '@nestjs/swagger';

export class PortfolioInvestmentItemDto {
  @ApiProperty({ description: 'Investment ID', example: '954c3193-d4f2-485d-8bc1-103ca84e2588' })
  id: string;

  @ApiProperty({ description: 'Project ID', example: '95da48fa-7cfb-4520-aa3c-b82057aee248' })
  projectId: string;

  @ApiProperty({ description: 'Project name/commodity', example: 'Corn' })
  projectName: string;

  @ApiProperty({ description: 'Farmer name', example: 'Ahmad Hidayat' })
  farmerName: string;

  @ApiProperty({ description: 'Investment amount in IDRX wei', example: '100000' })
  amount: string;

  @ApiProperty({ description: 'Receipt NFT Token ID', example: 6003 })
  receiptTokenId: number | null;

  @ApiProperty({ description: 'Investment date', example: '2025-12-29T15:49:33.784Z' })
  investedAt: Date;

  @ApiProperty({ description: 'Total profit claimed in IDRX wei', example: '8000' })
  profitClaimed: string;

  @ApiProperty({ description: 'Number of profit claims', example: 2 })
  profitClaimsCount: number;

  @ApiProperty({ description: 'Funding price per kilo', example: '22' })
  fundingPrice: string;

  @ApiProperty({ description: 'Total funding volume', example: '4500' })
  totalFunding: string;

  @ApiProperty({ description: 'Margin/ROI percentage', example: 8 })
  margin: number;

  @ApiProperty({
    description: 'Return asset calculated from amount * margin percentage',
    example: '8000'
  })
  returnAsset: string;

  @ApiProperty({
    description: 'Cumulative asset (amount + returnAsset)',
    example: '108000'
  })
  cumulativeAsset: string;
}

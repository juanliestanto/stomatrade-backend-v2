import { ApiProperty } from '@nestjs/swagger';

export class UserTotalDashboardResponseDto {
  @ApiProperty({
    description: 'Total assets amount (invested + profit)',
    example: '80000000000000000000000',
  })
  amountAssets: string;

  @ApiProperty({
    description: 'Total cash balance',
    example: '25000000000000000000000',
  })
  amountCash: string;

  @ApiProperty({
    description: 'Total return from assets (profit)',
    example: '20000000000000000000000',
  })
  returnAmountAssets: string;

  @ApiProperty({
    description: 'Percentage return on assets (ROI)',
    example: 25.5,
  })
  percentageAmountAssets: number;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Total invested amount',
    example: '60000000000000000000000',
  })
  totalInvested: string;

  @ApiProperty({
    description: 'Total profit earned',
    example: '20000000000000000000000',
  })
  totalProfit: string;

  @ApiProperty({
    description: 'Total claimed profit',
    example: '15000000000000000000000',
  })
  totalClaimed: string;

  @ApiProperty({
    description: 'Number of active investments',
    example: 5,
  })
  activeInvestments: number;

  @ApiProperty({
    description: 'Average ROI percentage',
    example: 25.5,
  })
  avgROI: number;
}

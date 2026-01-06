import { ApiProperty } from '@nestjs/swagger';
import { PortfolioInvestmentItemDto } from './portfolio-investment-item.dto';

export class PortfolioResponseDto {
  @ApiProperty({ description: 'Portfolio ID', example: '32f0c5a0-5b5c-447a-ac77-7683db80f0fb' })
  id: string;

  @ApiProperty({ description: 'User ID', example: '579ec3c4-a81f-4165-8cb4-3983b1dfa6e4' })
  userId: string;

  @ApiProperty({ description: 'Total invested amount in IDRX wei', example: '450000' })
  totalInvested: string;

  @ApiProperty({ description: 'Total profit earned in IDRX wei', example: '24000' })
  totalProfit: string;

  @ApiProperty({ description: 'Total claimed profit in IDRX wei', example: '24000' })
  totalClaimed: string;

  @ApiProperty({ description: 'Number of active investments', example: 3 })
  activeInvestments: number;

  @ApiProperty({ description: 'Number of completed investments', example: 0 })
  completedInvestments: number;

  @ApiProperty({ description: 'Average ROI percentage', example: 5.333333333333334 })
  avgROI: number;

  @ApiProperty({ description: 'Last calculation timestamp', example: '2026-01-04T13:00:00.839Z' })
  lastCalculatedAt: Date;

  @ApiProperty({ description: 'Creation timestamp', example: '2025-12-29T15:49:33.917Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-01-04T13:00:00.841Z' })
  updatedAt: Date;

  @ApiProperty({ description: 'Soft delete flag', example: false })
  deleted: boolean;

  @ApiProperty({
    description: 'List of investments',
    type: [PortfolioInvestmentItemDto]
  })
  investments: PortfolioInvestmentItemDto[];
}

import { ApiProperty } from '@nestjs/swagger';

export class UserAssetsResponseDto {
  @ApiProperty({
    description: 'Total assets value (total invested + total profit)',
    example: '80000000000000000000000',
  })
  amount: string;

  @ApiProperty({
    description: 'Total return amount (profit earned)',
    example: '20000000000000000000000',
  })
  returnAmount: string;

  @ApiProperty({
    description: 'Return percentage (ROI)',
    example: 25.5,
  })
  percentage: number;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

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
}

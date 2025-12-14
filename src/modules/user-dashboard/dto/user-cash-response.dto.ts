import { ApiProperty } from '@nestjs/swagger';

export class UserCashResponseDto {
  @ApiProperty({
    description: 'Total available cash balance (in IDRX wei)',
    example: '25000000000000000000000',
  })
  amount: string;

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
}

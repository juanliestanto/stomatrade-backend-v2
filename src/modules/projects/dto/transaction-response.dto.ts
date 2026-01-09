import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty({
    description: 'Success message describing the operation',
    example: 'Project closed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Blockchain transaction hash',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  transactionHash: string;

  @ApiProperty({
    description: 'Block number where transaction was confirmed',
    example: 12345678,
    required: false,
  })
  blockNumber?: number;

  @ApiProperty({
    description: 'Transaction status',
    example: 'CONFIRMED',
    enum: ['CONFIRMED', 'FAILED', 'PENDING'],
    required: false,
  })
  status?: string;
}

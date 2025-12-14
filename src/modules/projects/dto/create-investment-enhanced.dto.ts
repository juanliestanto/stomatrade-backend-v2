import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsOptional, IsDateString } from 'class-validator';

export class CreateInvestmentEnhancedDto {
  @ApiProperty({
    description: 'Investment amount (in IDRX wei)',
    example: '10000000000000000000000',
  })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({
    description: 'Quantity of items being invested in',
    example: 100,
  })
  @IsInt()
  @IsNotEmpty()
  quantityOfItems: number;

  @ApiProperty({
    description: 'Type of item',
    example: 'Rice Sacks',
  })
  @IsString()
  @IsNotEmpty()
  itemType: string;

  @ApiProperty({
    description: 'Submission date',
    example: '2025-12-14T10:30:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  submissionDate: string;

  @ApiProperty({
    description: 'Expected delivery date',
    example: '2026-03-15T10:30:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  deliveryDate: string;

  @ApiProperty({
    description: 'User ID (investor)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Additional notes (optional)',
    example: 'Investing in premium rice for Q1 2026',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

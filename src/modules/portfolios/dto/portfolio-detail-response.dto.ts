import { ApiProperty } from '@nestjs/swagger';
import { ProjectDetailResponseDto } from '../../projects/dto/project-detail-response.dto';

export class PortfolioDetailResponseDto extends ProjectDetailResponseDto {
  @ApiProperty({
    description: 'Investment amount (assets) in IDRX',
    example: '1000000',
  })
  assets: string;

  @ApiProperty({
    description: 'Return rate percentage (ROI)',
    example: 25,
  })
  returnRate: number;

  @ApiProperty({
    description: 'Total return/profit earned in IDRX',
    example: '250000',
  })
  returnAsset: string;

  @ApiProperty({
    description: 'Cumulative asset (assets + return) in IDRX',
    example: '1250000',
  })
  cumulativeAsset: string;
}

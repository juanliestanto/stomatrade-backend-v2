import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export class SearchQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search term (searches across multiple relevant fields)',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

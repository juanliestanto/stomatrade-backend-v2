import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PortfoliosService } from './portfolios.service';
import { PortfolioDetailResponseDto } from './dto/portfolio-detail-response.dto';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ROLES } from '@prisma/client';

@ApiTags('Portfolios')
@ApiBearerAuth('JWT-auth')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Public()
  @Get('stats')
  @ApiOperation({
    summary: 'Get global portfolio statistics (Public)',
    description: 'Retrieve aggregated statistics across all investor portfolios',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Global statistics retrieved successfully',
  })
  getGlobalStats() {
    return this.portfoliosService.getGlobalStats();
  }

  @Public()
  @Get('top-investors')
  @ApiOperation({
    summary: 'Get top investors (Public)',
    description: 'Retrieve the top investors by total invested amount',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top investors to return (default: 10)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top investors retrieved successfully',
  })
  getTopInvestors(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.portfoliosService.getTopInvestors(limit || 10);
  }

  @Roles(ROLES.ADMIN)
  @Get('all')
  @ApiOperation({
    summary: 'Get all portfolios (Admin only)',
    description: 'Retrieve all investor portfolios',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All portfolios retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  getAllPortfolios() {
    return this.portfoliosService.getAllPortfolios();
  }

  @Get('user/:userId/:projectId/detail')
  @ApiOperation({
    summary: 'Get detailed user portfolio for a specific project (authenticated users)',
    description:
      'Retrieve comprehensive portfolio details for a specific investment including project information, assets, returns, and cumulative values',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '579ec3c4-a81f-4165-8cb4-3983b1dfa6e4',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Project UUID',
    example: '95da48fa-7cfb-4520-aa3c-b82057aee248',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User portfolio detail for the project retrieved successfully',
    type: PortfolioDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or investment not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  getUserPortfolioDetail(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<PortfolioDetailResponseDto> {
    return this.portfoliosService.getUserPortfolioDetail(userId, projectId);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get user portfolio (authenticated users)',
    description: 'Retrieve investment portfolio for a specific user including returnAsset and cumulativeAsset for each investment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User portfolio retrieved successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  getUserPortfolio(@Param('userId', ParseUUIDPipe) userId: string): Promise<PortfolioResponseDto> {
    return this.portfoliosService.getUserPortfolio(userId);
  }
}
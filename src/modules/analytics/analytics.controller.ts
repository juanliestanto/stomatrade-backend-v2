import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRequestDto } from './dto/analytics-request.dto';
import { GrowthAnalyticsResponseDto } from './dto/analytics-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROLES } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(ROLES.ADMIN)
  @Get('projects/growth')
  @ApiOperation({
    summary: 'Get project growth analytics (Admin only)',
    description:
      'Retrieve project growth statistics by period with optional limit and date range. ' +
      'Default limits: daily=30, weekly=12, monthly=12, yearly=all',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project growth analytics retrieved successfully',
    type: GrowthAnalyticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  getProjectGrowth(@Query() query: AnalyticsRequestDto): Promise<GrowthAnalyticsResponseDto> {
    return this.analyticsService.getProjectGrowth(query.period, query.limit, query.startDate, query.endDate);
  }

  @Roles(ROLES.ADMIN)
  @Get('investors/growth')
  @ApiOperation({
    summary: 'Get investor growth analytics (Admin only)',
    description:
      'Retrieve investor growth statistics by period with optional limit and date range. ' +
      'Default limits: daily=30, weekly=12, monthly=12, yearly=all',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Investor growth analytics retrieved successfully',
    type: GrowthAnalyticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  getInvestorGrowth(@Query() query: AnalyticsRequestDto): Promise<GrowthAnalyticsResponseDto> {
    return this.analyticsService.getInvestorGrowth(query.period, query.limit, query.startDate, query.endDate);
  }

  @Roles(ROLES.ADMIN)
  @Get('users/growth')
  @ApiOperation({
    summary: 'Get user growth analytics (Admin only)',
    description:
      'Retrieve user growth statistics by period with optional limit and date range. ' +
      'Default limits: daily=30, weekly=12, monthly=12, yearly=all',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User growth analytics retrieved successfully',
    type: GrowthAnalyticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  getUserGrowth(@Query() query: AnalyticsRequestDto): Promise<GrowthAnalyticsResponseDto> {
    return this.analyticsService.getUserGrowth(query.period, query.limit, query.startDate, query.endDate);
  }
}

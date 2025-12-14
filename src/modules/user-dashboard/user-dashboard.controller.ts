import { Controller, Get, Param, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { UserDashboardService } from './user-dashboard.service';
import { UserCashResponseDto } from './dto/user-cash-response.dto';
import { UserAssetsResponseDto } from './dto/user-assets-response.dto';
import { UserTotalDashboardResponseDto } from './dto/user-total-dashboard-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('User Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('user-dashboard')
export class UserDashboardController {
  constructor(private readonly dashboardService: UserDashboardService) {}

  @Public()
  @Get(':userId/cash')
  @ApiOperation({
    summary: 'Get user total cash',
    description: 'Retrieve total available cash balance for a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User cash balance retrieved successfully',
    type: UserCashResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getUserCash(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserCashResponseDto> {
    return this.dashboardService.getUserCash(userId);
  }

  @Public()
  @Get(':userId/assets')
  @ApiOperation({
    summary: 'Get user total assets',
    description: 'Retrieve total assets including investments and returns for a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User assets retrieved successfully',
    type: UserAssetsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getUserAssets(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserAssetsResponseDto> {
    return this.dashboardService.getUserAssets(userId);
  }

  @Public()
  @Get(':userId/total')
  @ApiOperation({
    summary: 'Get user total dashboard',
    description: 'Retrieve complete dashboard with cash, assets, and returns for a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User total dashboard retrieved successfully',
    type: UserTotalDashboardResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getUserTotalDashboard(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserTotalDashboardResponseDto> {
    return this.dashboardService.getUserTotalDashboard(userId);
  }
}

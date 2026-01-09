import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProfitsService } from './profits.service';
import { DepositProfitDto } from './dto/deposit-profit.dto';
import { ClaimProfitDto } from './dto/claim-profit.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROLES } from '@prisma/client';

@ApiTags('Profits')
@ApiBearerAuth('JWT-auth')
@Controller('profits')
export class ProfitsController {
  constructor(private readonly profitsService: ProfitsService) {}

  /**
   * @deprecated This endpoint is misleading. It actually calls withdrawProject() on the smart contract.
   * Use POST /projects/:id/withdraw-funds instead for clearer semantics.
   * This endpoint is maintained for backward compatibility only.
   */
  @Roles(ROLES.ADMIN)
  @Post('deposit')
  @ApiOperation({
    summary: '[DEPRECATED] Withdraw project funds (Admin only)',
    description:
      '⚠️ DEPRECATED: This endpoint name is misleading. It actually calls withdrawProject() on the smart contract, ' +
      'which withdraws project funds from blockchain after project completion. ' +
      'Use POST /projects/:id/withdraw-funds instead for clearer semantics. ' +
      'This endpoint is maintained for backward compatibility only.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Project funds withdrawn successfully from blockchain',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project not minted or blockchain transaction failed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  depositProfit(@Body() dto: DepositProfitDto) {
    return this.profitsService.depositProfit(dto);
  }

  /**
   * Note: This endpoint calls claimWithdraw() on the smart contract.
   * The naming is kept for backward compatibility and business logic clarity.
   */
  @Post('claim')
  @ApiOperation({
    summary: 'Claim profit from a project (authenticated users)',
    description:
      'Investor claims their proportional profit from blockchain. ' +
      'Note: This calls claimWithdraw() on the smart contract.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Profit claimed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'User has not invested in project or blockchain transaction failed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or Project not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  claimProfit(@Body() dto: ClaimProfitDto) {
    return this.profitsService.claimProfit(dto);
  }

  @Roles(ROLES.ADMIN)
  @Get('pools')
  @ApiOperation({
    summary: 'Get all profit pools (Admin only)',
    description: 'Retrieve all profit pools with statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profit pools retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  getAllProfitPools() {
    return this.profitsService.getAllProfitPools();
  }

  @Get('project/:projectId')
  @ApiOperation({
    summary: 'Get profit pool for a project (authenticated users)',
    description: 'Retrieve profit pool statistics for a specific project',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profit pool retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  getProjectProfitPool(@Param('projectId') projectId: string) {
    return this.profitsService.getProjectProfitPool(projectId);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get user profit claims (authenticated users)',
    description: 'Retrieve all profit claims made by a specific user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profit claims retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  getUserProfitClaims(@Param('userId') userId: string) {
    return this.profitsService.getUserProfitClaims(userId);
  }
}
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { MarkRefundableDto } from './dto/mark-refundable.dto';
import { RefundClaimRequestDto } from './dto/claim-refund.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROLES } from '@prisma/client';

@ApiTags('Refunds')
@ApiBearerAuth('JWT-auth')
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  /**
   * @deprecated This endpoint duplicates POST /projects/:id/refund functionality.
   * Use POST /projects/:id/refund instead for better REST semantics.
   * This endpoint is maintained for backward compatibility only.
   */
  @Roles(ROLES.ADMIN)
  @Post('mark-refundable')
  @ApiOperation({
    summary: '[DEPRECATED] Mark project as refundable (Admin only)',
    description:
      '⚠️ DEPRECATED: This endpoint duplicates POST /projects/:id/refund functionality. ' +
      'Use POST /projects/:id/refund instead for better REST semantics and consistency. ' +
      'This endpoint is maintained for backward compatibility only.\n\n' +
      'Admin marks a project as refundable when crowdfunding fails or project is cancelled',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project marked as refundable successfully',
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
  markRefundable(@Body() dto: MarkRefundableDto) {
    return this.refundsService.markRefundable(dto);
  }

  /**
   * @deprecated This endpoint duplicates POST /projects/:id/claim-refund functionality.
   * Use POST /projects/:id/claim-refund instead for better REST semantics.
   * This endpoint is maintained for backward compatibility only.
   */
  @Post('claim')
  @ApiOperation({
    summary: '[DEPRECATED] Claim refund from a project (authenticated users)',
    description:
      '⚠️ DEPRECATED: This endpoint duplicates POST /projects/:id/claim-refund functionality. ' +
      'Use POST /projects/:id/claim-refund instead for better REST semantics and consistency. ' +
      'This endpoint is maintained for backward compatibility only.\n\n' +
      'Investor claims their investment back from a refundable project',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund claimed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User has not invested or blockchain transaction failed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or Project not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  claimRefund(@Body() dto: RefundClaimRequestDto) {
    return this.refundsService.claimRefund(dto);
  }

  @Get('projects')
  @ApiOperation({
    summary: 'Get all refundable projects (authenticated users)',
    description: 'Retrieve list of projects that are eligible for refunds',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refundable projects retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  getRefundableProjects() {
    return this.refundsService.getRefundableProjects();
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get user refund claims (authenticated users)',
    description: 'Retrieve all refund claims made by a specific user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User refund claims retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  getUserRefundClaims(@Param('userId') userId: string) {
    return this.refundsService.getUserRefundClaims(userId);
  }
}
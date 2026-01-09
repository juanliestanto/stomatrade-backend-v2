import {
  Controller,
  Post,
  Get,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { ROLES } from '@prisma/client';
import { HistoricalSyncService } from '../services/historical-sync.service';

class SyncHistoricalEventsDto {
  fromBlock: number;
  toBlock?: number | 'latest';
  batchSize?: number;
}

@ApiTags('Blockchain Sync')
@ApiBearerAuth('JWT-auth')
@Controller('blockchain/sync')
export class BlockchainSyncController {
  constructor(
    private readonly historicalSyncService: HistoricalSyncService,
  ) {}

  @Roles(ROLES.ADMIN)
  @Post('historical')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync historical blockchain events (Admin only)',
    description:
      'Synchronize historical blockchain events from a specific block range. ' +
      'This is useful for catching up on missed events or rebuilding event history. ' +
      'Process runs in batches to avoid RPC rate limits.',
  })
  @ApiBody({
    description: 'Sync configuration',
    schema: {
      type: 'object',
      properties: {
        fromBlock: {
          type: 'number',
          description: 'Starting block number',
          example: 33000000,
        },
        toBlock: {
          oneOf: [{ type: 'number' }, { type: 'string' }],
          description: 'Ending block number or "latest"',
          example: 'latest',
        },
        batchSize: {
          type: 'number',
          description: 'Number of blocks to process per batch (default: 1000)',
          example: 1000,
        },
      },
      required: ['fromBlock'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        blocksProcessed: { type: 'number' },
        eventsProcessed: { type: 'number' },
        errors: { type: 'array', items: { type: 'string' } },
        startBlock: { type: 'number' },
        endBlock: { type: 'number' },
        duration: { type: 'number', description: 'Duration in milliseconds' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Sync already in progress or invalid parameters',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async syncHistoricalEvents(@Body() dto: SyncHistoricalEventsDto) {
    return this.historicalSyncService.syncHistoricalEvents(
      dto.fromBlock,
      dto.toBlock || 'latest',
      dto.batchSize || 1000,
    );
  }

  @Roles(ROLES.ADMIN)
  @Post('since-last')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync events since last synced block (Admin only)',
    description:
      'Automatically sync all events since the last recorded block. ' +
      'Useful for periodic catch-up syncs.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync completed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Sync already in progress',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async syncSinceLastBlock() {
    return this.historicalSyncService.syncSinceLastBlock();
  }

  @Roles(ROLES.ADMIN, ROLES.STAFF)
  @Get('status')
  @ApiOperation({
    summary: 'Get sync status (Admin/Staff only)',
    description: 'Get current synchronization status including last synced block',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        lastSyncedBlock: { type: 'number' },
        currentBlock: { type: 'number' },
        blocksBehind: { type: 'number' },
        isSyncing: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin/Staff access required',
  })
  async getSyncStatus() {
    return this.historicalSyncService.getSyncStatus();
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainEventService } from './blockchain-event.service';
import { EthersProviderService } from './ethers-provider.service';

export interface SyncProgress {
  startBlock: number;
  endBlock: number;
  currentBlock: number;
  eventsProcessed: number;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  blocksProcessed: number;
  eventsProcessed: number;
  errors: string[];
  startBlock: number;
  endBlock: number;
  duration: number;
}

@Injectable()
export class HistoricalSyncService {
  private readonly logger = new Logger(HistoricalSyncService.name);
  private isSyncing = false;
  private readonly BATCH_SIZE = 1000; // Process 1000 blocks at a time
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainEventService: BlockchainEventService,
    private readonly providerService: EthersProviderService,
  ) {}

  /**
   * Sync historical events from a specific block range
   * @param fromBlock - Starting block number
   * @param toBlock - Ending block number (or 'latest')
   * @param batchSize - Number of blocks to process in each batch
   */
  async syncHistoricalEvents(
    fromBlock: number,
    toBlock: number | 'latest' = 'latest',
    batchSize: number = this.BATCH_SIZE,
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let eventsProcessed = 0;

    try {
      const currentBlock = await this.providerService.getBlockNumber();
      const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

      this.logger.log(
        `Starting historical sync from block ${fromBlock} to ${endBlock}`,
      );

      // Process in batches to avoid RPC rate limits
      for (
        let batchStart = fromBlock;
        batchStart <= endBlock;
        batchStart += batchSize
      ) {
        const batchEnd = Math.min(batchStart + batchSize - 1, endBlock);

        this.logger.log(
          `Processing batch: blocks ${batchStart} to ${batchEnd}`,
        );

        try {
          const batchEvents = await this.processBatch(batchStart, batchEnd);
          eventsProcessed += batchEvents;
        } catch (error) {
          const errorMsg = `Error processing batch ${batchStart}-${batchEnd}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);

          // Continue with next batch even if one fails
        }
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `Historical sync completed. Processed ${eventsProcessed} events in ${duration}ms`,
      );

      return {
        success: errors.length === 0,
        blocksProcessed: endBlock - fromBlock + 1,
        eventsProcessed,
        errors,
        startBlock: fromBlock,
        endBlock,
        duration,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync events since last recorded block
   */
  async syncSinceLastBlock(): Promise<SyncResult> {
    const lastSyncedBlock = await this.getLastSyncedBlock();
    const currentBlock = await this.providerService.getBlockNumber();

    this.logger.log(
      `Syncing from last synced block ${lastSyncedBlock} to current block ${currentBlock}`,
    );

    if (lastSyncedBlock >= currentBlock) {
      this.logger.log('Already up to date');
      return {
        success: true,
        blocksProcessed: 0,
        eventsProcessed: 0,
        errors: [],
        startBlock: lastSyncedBlock,
        endBlock: currentBlock,
        duration: 0,
      };
    }

    const result = await this.syncHistoricalEvents(
      lastSyncedBlock + 1,
      currentBlock,
    );

    // Update last synced block
    if (result.success) {
      await this.updateLastSyncedBlock(currentBlock);
    }

    return result;
  }

  /**
   * Process a batch of blocks for all event types
   */
  private async processBatch(
    fromBlock: number,
    toBlock: number,
  ): Promise<number> {
    let eventsProcessed = 0;

    const eventTypes = [
      'ProjectCreated',
      'FarmerAdded',
      'Invested',
      'ProfitDeposited',
      'ProfitClaimed',
      'Refunded',
      'ProjectClosed',
      'ProjectFinished',
      'ProjectRefunded',
    ];

    for (const eventType of eventTypes) {
      try {
        const events = await this.blockchainEventService.queryPastEvents(
          eventType,
          fromBlock,
          toBlock,
        );

        this.logger.debug(
          `Found ${events.length} ${eventType} events in blocks ${fromBlock}-${toBlock}`,
        );

        // Process events sequentially to maintain order
        for (const event of events) {
          await this.processEvent(event);
          eventsProcessed++;
        }
      } catch (error) {
        this.logger.error(
          `Error querying ${eventType} events in batch ${fromBlock}-${toBlock}`,
          error.stack,
        );
        throw error;
      }
    }

    return eventsProcessed;
  }

  /**
   * Process a single blockchain event
   * Note: Currently logs events. Future versions will store in dedicated BlockchainEvent table.
   */
  private async processEvent(event: any): Promise<void> {
    this.logger.debug(
      `Processing ${event.eventName} event from block ${event.blockNumber}, tx: ${event.transactionHash}`,
    );

    // Log event details for now
    // TODO: Store in dedicated BlockchainEvent table when schema is updated
    this.logger.log(
      `Event: ${event.eventName} | Block: ${event.blockNumber} | Args: ${JSON.stringify(event.args)}`,
    );
  }

  /**
   * Get the last synced block number
   * Note: Uses environment variable or returns 0. Future versions will use database.
   */
  private async getLastSyncedBlock(): Promise<number> {
    // Check if there's a stored last synced block in environment
    const lastBlock = process.env.LAST_SYNCED_BLOCK;
    if (lastBlock) {
      return parseInt(lastBlock, 10);
    }

    // If no stored block, return 0 (start from genesis)
    // TODO: Store in SystemMetadata table when schema is updated
    return 0;
  }

  /**
   * Update last synced block
   * Note: Currently logs only. Future versions will store in database.
   */
  private async updateLastSyncedBlock(blockNumber: number): Promise<void> {
    this.logger.log(`Last synced block updated to: ${blockNumber}`);
    // TODO: Store in SystemMetadata table when schema is updated
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    lastSyncedBlock: number;
    currentBlock: number;
    blocksBehind: number;
    isSyncing: boolean;
  }> {
    const lastSyncedBlock = await this.getLastSyncedBlock();
    const currentBlock = await this.providerService.getBlockNumber();

    return {
      lastSyncedBlock,
      currentBlock,
      blocksBehind: currentBlock - lastSyncedBlock,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Get sync progress (if sync is running)
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainEventService } from '../../blockchain/services/blockchain-event.service';
import { EthersProviderService } from '../../blockchain/services/ethers-provider.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private lastSyncedBlock: number = 0;
  private isSyncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: BlockchainEventService,
    private readonly providerService: EthersProviderService,
  ) {}

  /**
   * Helper to serialize event args containing BigInt values
   */
  private serializeEventArgs(args: any): string {
    return JSON.stringify(args, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async recalculatePortfolios() {
    this.logger.log('Starting scheduled portfolio recalculation...');

    try {
      const users = await this.prisma.user.findMany({
        where: {
          investments: {
            some: {},
          },
          deleted: false,
        },
      });

      for (const user of users) {
        await this.updateUserPortfolio(user.id);
      }

      this.logger.log(`Recalculated portfolios for ${users.length} users`);
    } catch (error) {
      this.logger.error('Error recalculating portfolios', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncBlockchainEvents() {
    if (this.isSyncing) {
      this.logger.warn('Event sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    this.logger.log('Starting scheduled blockchain event sync...');

    try {
      const currentBlock = await this.providerService.getBlockNumber();

      if (this.lastSyncedBlock === 0) {
        this.lastSyncedBlock = Math.max(0, currentBlock - 1000);
      }

      await this.syncEventsFromBlock(this.lastSyncedBlock, currentBlock);
      
      this.lastSyncedBlock = currentBlock;
      this.logger.log(`Event sync completed. Current block: ${currentBlock}`);
    } catch (error) {
      this.logger.error('Error syncing blockchain events', error);
    } finally {
      this.isSyncing = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredData() {
    this.logger.log('Starting scheduled cleanup...');

    try {
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const staleTransactions = await this.prisma.blockchainTransaction.updateMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: oneDayAgo,
          },
        },
        data: {
          status: 'FAILED',
          errorMessage: 'Transaction timed out after 24 hours',
        },
      });

      if (staleTransactions.count > 0) {
        this.logger.log(`Marked ${staleTransactions.count} stale transactions as failed`);
      }
    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyStats() {
    this.logger.log('Calculating daily statistics...');

    try {
      
      const totalUsers = await this.prisma.user.count({ where: { deleted: false } });
      const totalFarmers = await this.prisma.farmer.count({ where: { deleted: false } });
      const totalProjects = await this.prisma.project.count({ where: { deleted: false } });
      const totalInvestments = await this.prisma.investment.count({ where: { deleted: false } });

      const mintedFarmers = await this.prisma.farmer.count({
        where: { tokenId: { not: null }, deleted: false },
      });
      const mintedProjects = await this.prisma.project.count({
        where: { tokenId: { not: null }, deleted: false },
      });

      this.logger.log(`Daily Stats - Users: ${totalUsers}, Farmers: ${totalFarmers} (${mintedFarmers} minted), Projects: ${totalProjects} (${mintedProjects} minted), Investments: ${totalInvestments}`);
    } catch (error) {
      this.logger.error('Error calculating daily stats', error);
    }
  }

  private async updateUserPortfolio(userId: string) {
    const investments = await this.prisma.investment.findMany({
      where: { userId, deleted: false },
      include: {
        profitClaims: true,
      },
    });

    const totalInvested = investments.reduce(
      (sum, inv) => sum + BigInt(inv.amount),
      BigInt(0),
    );

    const totalClaimed = investments.reduce((sum, inv) => {
      const claimed = inv.profitClaims.reduce(
        (claimSum, claim) => claimSum + BigInt(claim.amount),
        BigInt(0),
      );
      return sum + claimed;
    }, BigInt(0));

    const totalProfit = totalClaimed;
    const activeInvestments = investments.filter(
      (inv) => inv.receiptTokenId !== null,
    ).length;

    const avgROI =
      totalInvested > BigInt(0)
        ? (Number(totalProfit) / Number(totalInvested)) * 100
        : 0;

    await this.prisma.investmentPortfolio.upsert({
      where: { userId },
      update: {
        totalInvested: totalInvested.toString(),
        totalProfit: totalProfit.toString(),
        totalClaimed: totalClaimed.toString(),
        activeInvestments,
        avgROI,
        lastCalculatedAt: new Date(),
      },
      create: {
        userId,
        totalInvested: totalInvested.toString(),
        totalProfit: totalProfit.toString(),
        totalClaimed: totalClaimed.toString(),
        activeInvestments,
        completedInvestments: 0,
        avgROI,
      },
    });
  }

  private async syncEventsFromBlock(fromBlock: number, toBlock: number) {
    const eventTypes = [
      'ProjectCreated',
      'FarmerAdded', // Changed from FarmerMinted in new contract
      'Invested',
      'ProfitDeposited',
      'ProfitClaimed',
      'Refunded',
    ];

    for (const eventType of eventTypes) {
      try {
        const events = await this.eventService.queryPastEvents(
          eventType,
          fromBlock,
          toBlock,
        );

        for (const event of events) {
          await this.processEvent(eventType, event);
        }

        if (events.length > 0) {
          this.logger.log(`Processed ${events.length} ${eventType} events`);
        }
      } catch (error) {
        this.logger.error(`Error syncing ${eventType} events`, error);
      }
    }
  }

  private async processEvent(eventType: string, event: any) {
    switch (eventType) {
      case 'ProjectCreated':
        await this.handleProjectCreatedEvent(event);
        break;
      case 'FarmerAdded':
        await this.handleFarmerAddedEvent(event);
        break;
      case 'Invested':
        await this.handleInvestedEvent(event);
        break;
      case 'ProfitDeposited':
        await this.handleProfitDepositedEvent(event);
        break;
      case 'ProfitClaimed':
        await this.handleProfitClaimedEvent(event);
        break;
      case 'Refunded':
        await this.handleRefundedEvent(event);
        break;
    }
  }

  private async handleProjectCreatedEvent(event: any) {
    const { args, transactionHash, blockNumber } = event;

    const existing = await this.prisma.blockchainTransaction.findUnique({
      where: { transactionHash },
    });

    if (existing) return;

    await this.prisma.blockchainTransaction.create({
      data: {
        transactionHash,
        transactionType: 'CREATE_PROJECT',
        status: 'CONFIRMED',
        fromAddress: args.owner || '',
        blockNumber,
        eventData: this.serializeEventArgs(args),
      },
    });
  }

  private async handleFarmerAddedEvent(event: any) {
    const { args, transactionHash, blockNumber } = event;

    const existing = await this.prisma.blockchainTransaction.findUnique({
      where: { transactionHash },
    });

    if (existing) return;

    await this.prisma.blockchainTransaction.create({
      data: {
        transactionHash,
        transactionType: 'MINT_FARMER_NFT',
        status: 'CONFIRMED',
        fromAddress: args.farmer || '',
        blockNumber,
        eventData: this.serializeEventArgs(args),
      },
    });
  }

  private async handleInvestedEvent(event: any) {
    const { args, transactionHash, blockNumber } = event;

    const existing = await this.prisma.blockchainTransaction.findUnique({
      where: { transactionHash },
    });

    if (existing) return;

    await this.prisma.blockchainTransaction.create({
      data: {
        transactionHash,
        transactionType: 'INVEST',
        status: 'CONFIRMED',
        fromAddress: args.investor || '',
        blockNumber,
        eventData: this.serializeEventArgs(args),
      },
    });
  }

  private async handleProfitDepositedEvent(event: any) {
    const { args, transactionHash, blockNumber } = event;

    const existing = await this.prisma.blockchainTransaction.findUnique({
      where: { transactionHash },
    });

    if (existing) return;

    await this.prisma.blockchainTransaction.create({
      data: {
        transactionHash,
        transactionType: 'DEPOSIT_PROFIT',
        status: 'CONFIRMED',
        fromAddress: '',
        blockNumber,
        eventData: this.serializeEventArgs(args),
      },
    });
  }

  private async handleProfitClaimedEvent(event: any) {
    const { args, transactionHash, blockNumber } = event;

    const existing = await this.prisma.blockchainTransaction.findUnique({
      where: { transactionHash },
    });

    if (existing) return;

    await this.prisma.blockchainTransaction.create({
      data: {
        transactionHash,
        transactionType: 'CLAIM_PROFIT',
        status: 'CONFIRMED',
        fromAddress: args.user || '',
        blockNumber,
        eventData: this.serializeEventArgs(args),
      },
    });
  }

  private async handleRefundedEvent(event: any) {
    const { args, transactionHash, blockNumber } = event;

    const existing = await this.prisma.blockchainTransaction.findUnique({
      where: { transactionHash },
    });

    if (existing) return;

    await this.prisma.blockchainTransaction.create({
      data: {
        transactionHash,
        transactionType: 'REFUND',
        status: 'CONFIRMED',
        fromAddress: args.investor || '',
        blockNumber,
        eventData: this.serializeEventArgs(args),
      },
    });
  }
}
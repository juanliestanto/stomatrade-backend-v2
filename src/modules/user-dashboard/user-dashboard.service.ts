import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserCashResponseDto } from './dto/user-cash-response.dto';
import { UserAssetsResponseDto } from './dto/user-assets-response.dto';
import { UserTotalDashboardResponseDto } from './dto/user-total-dashboard-response.dto';

@Injectable()
export class UserDashboardService {
  private readonly logger = new Logger(UserDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserCash(userId: string): Promise<UserCashResponseDto> {
    this.logger.log(`Getting cash balance for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted: false },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      amount: user.balance,
      userId: user.id,
      walletAddress: user.walletAddress,
    };
  }

  async getUserAssets(userId: string): Promise<UserAssetsResponseDto> {
    this.logger.log(`Getting assets for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted: false },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get or create portfolio
    let portfolio = await this.prisma.investmentPortfolio.findUnique({
      where: { userId },
    });

    if (!portfolio) {
      // Create empty portfolio if doesn't exist
      portfolio = await this.prisma.investmentPortfolio.create({
        data: {
          userId,
          totalInvested: '0',
          totalProfit: '0',
          totalClaimed: '0',
          activeInvestments: 0,
          completedInvestments: 0,
          avgROI: 0,
        },
      });
    }

    const totalInvested = BigInt(portfolio.totalInvested);
    const totalProfit = BigInt(portfolio.totalProfit);
    const totalAssets = totalInvested + totalProfit;

    const percentage = totalInvested > BigInt(0)
      ? (Number(totalProfit) / Number(totalInvested)) * 100
      : 0;

    return {
      amount: totalAssets.toString(),
      returnAmount: totalProfit.toString(),
      percentage: Math.round(percentage * 100) / 100, // Round to 2 decimals
      userId: user.id,
      totalInvested: totalInvested.toString(),
      totalProfit: totalProfit.toString(),
    };
  }

  async getUserTotalDashboard(userId: string): Promise<UserTotalDashboardResponseDto> {
    this.logger.log(`Getting total dashboard for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted: false },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get or create portfolio
    let portfolio = await this.prisma.investmentPortfolio.findUnique({
      where: { userId },
    });

    if (!portfolio) {
      portfolio = await this.prisma.investmentPortfolio.create({
        data: {
          userId,
          totalInvested: '0',
          totalProfit: '0',
          totalClaimed: '0',
          activeInvestments: 0,
          completedInvestments: 0,
          avgROI: 0,
        },
      });
    }

    const totalInvested = BigInt(portfolio.totalInvested);
    const totalProfit = BigInt(portfolio.totalProfit);
    const totalAssets = totalInvested + totalProfit;
    const cashBalance = BigInt(user.balance);

    const percentageAmountAssets = totalInvested > BigInt(0)
      ? (Number(totalProfit) / Number(totalInvested)) * 100
      : 0;

    return {
      amountAssets: totalAssets.toString(),
      amountCash: cashBalance.toString(),
      returnAmountAssets: totalProfit.toString(),
      percentageAmountAssets: Math.round(percentageAmountAssets * 100) / 100,
      userId: user.id,
      walletAddress: user.walletAddress,
      totalInvested: totalInvested.toString(),
      totalProfit: totalProfit.toString(),
      totalClaimed: portfolio.totalClaimed,
      activeInvestments: portfolio.activeInvestments,
      avgROI: Math.round(portfolio.avgROI * 100) / 100,
    };
  }
}

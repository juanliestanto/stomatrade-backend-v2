import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PortfolioDetailResponseDto } from './dto/portfolio-detail-response.dto';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';
import { PortfolioInvestmentItemDto } from './dto/portfolio-investment-item.dto';

@Injectable()
export class PortfoliosService {
  private readonly logger = new Logger(PortfoliosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserPortfolio(userId: string): Promise<PortfolioResponseDto> {
    this.logger.log(`Getting portfolio for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

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

    const investments = await this.prisma.investment.findMany({
      where: { userId, deleted: false },
      include: {
        project: {
          include: {
            farmer: true,
            land: true,
            collector: true,
          },
        },
        profitClaims: true,
      },
      orderBy: {
        investedAt: 'desc',
      },
    });

    const projectIds = investments.map(inv => inv.projectId);
    const projectImages = await this.prisma.file.findMany({
      where: {
        reffId: { in: projectIds },
        deleted: false,
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['reffId'],
    });

    const imageMap = new Map<string, string>();
    projectImages.forEach(file => {
      if (!imageMap.has(file.reffId)) {
        imageMap.set(file.reffId, file.url);
      }
    });

    return {
      ...portfolio,
      investments: investments.map((inv) => {
        const profitClaimed = inv.profitClaims
          .reduce((sum, claim) => sum + BigInt(claim.amount), BigInt(0))
          .toString();

        const fundingPrice =
          inv.project.totalKilos && inv.project.totalKilos > 0
            ? (Number(inv.amount) / inv.project.totalKilos).toFixed(0)
            : '0';

        const totalFunding = inv.project.volume ? inv.project.volume.toFixed(0) : '0';

        const investmentAmount = BigInt(inv.amount);
        const claimedProfit = BigInt(profitClaimed);
        const margin =
          investmentAmount > BigInt(0)
            ? Number((claimedProfit * BigInt(10000)) / investmentAmount) / 100
            : 0;

        const returnAsset =
          investmentAmount > BigInt(0)
            ? ((investmentAmount * BigInt(Math.floor(margin * 100))) / BigInt(10000)).toString()
            : '0';

        const cumulativeAsset = (investmentAmount + BigInt(returnAsset)).toString();

        return {
          id: inv.id,
          projectId: inv.projectId,
          projectName: inv.project.commodity,
          farmerName: inv.project.farmer.name,
          collectorName: inv.project.collector.name,
          image: imageMap.get(inv.projectId) || null,
          amount: inv.amount,
          receiptTokenId: inv.receiptTokenId,
          investedAt: inv.investedAt,
          profitClaimed,
          profitClaimsCount: inv.profitClaims.length,
          fundingPrice,
          totalFunding,
          margin,
          returnAsset,
          cumulativeAsset,
        };
      }),
    };
  }

  async getUserPortfolioDetail(
    userId: string,
    projectId: string,
  ): Promise<PortfolioDetailResponseDto> {
    this.logger.log(`Getting detailed portfolio for user ${userId} and project ${projectId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const investment = await this.prisma.investment.findFirst({
      where: {
        userId,
        projectId,
        deleted: false,
      },
      include: {
        project: {
          include: {
            collector: true,
            farmer: true,
            land: true,
            projectSubmission: true,
            investments: {
              where: { deleted: false },
            },
          },
        },
        profitClaims: true,
      },
    });

    if (!investment) {
      throw new NotFoundException(
        `Investment not found for user ${userId} in project ${projectId}`,
      );
    }

    const project = investment.project;

    const file = await this.prisma.file.findFirst({
      where: {
        reffId: project.id,
        deleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const currentFunding = project.investments.reduce(
      (sum, inv) => sum + BigInt(inv.amount),
      BigInt(0),
    );

    const uniqueInvestors = new Set(project.investments.map((inv) => inv.userId)).size;

    const maxFunding = BigInt(project.projectSubmission?.maxCrowdFunding || '0');
    const fundingPercentage =
      maxFunding > BigInt(0) ? (Number(currentFunding) / Number(maxFunding)) * 100 : 0;

    const assets = investment.amount;

    const totalReturn = investment.profitClaims.reduce(
      (sum, claim) => sum + BigInt(claim.amount),
      BigInt(0),
    );

    const investmentAmount = BigInt(assets);
    const returnRate =
      investmentAmount > BigInt(0)
        ? Number((totalReturn * BigInt(10000)) / investmentAmount) / 100
        : 0;

    const cumulativeAsset = (investmentAmount + totalReturn).toString();

    return {
      projectId: project.id,
      volume: project.volume,
      commodity: project.commodity,
      submissionDate: project.projectSubmission?.createdAt || project.createdAt,
      deliveryDate: project.sendDate,
      projectPrice: project.projectSubmission?.valueProject || '0',
      fundingPrice: project.projectSubmission?.maxCrowdFunding || '0',
      currentFundingPrice: currentFunding.toString(),
      returnInvestmentRate: project.profitShare,
      projectName: project.name,
      collectorName: project.collector.name,
      farmerName: project.farmer.name,
      investors: uniqueInvestors,
      status: project.status,
      fundingPercentage: Math.round(fundingPercentage * 100) / 100,
      image: file?.url || null,
      landAddress: project.land.address,
      gradeQuality: null,
      assets: assets,
      returnRate: Math.round(returnRate * 100) / 100,
      returnAsset: totalReturn.toString(),
      cumulativeAsset: cumulativeAsset,
    };
  }

  async getAllPortfolios() {
    this.logger.log('Getting all portfolios');

    return await this.prisma.investmentPortfolio.findMany({
      where: { deleted: false },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            role: true,
          },
        },
      },
      orderBy: {
        totalInvested: 'desc',
      },
    });
  }

  async getTopInvestors(limit = 10) {
    this.logger.log(`Getting top ${limit} investors`);

    return await this.prisma.investmentPortfolio.findMany({
      where: { deleted: false },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
          },
        },
      },
      orderBy: {
        totalInvested: 'desc',
      },
      take: limit,
    });
  }

  async getGlobalStats() {
    this.logger.log('Calculating global portfolio statistics');

    const portfolios = await this.prisma.investmentPortfolio.findMany({
      where: { deleted: false },
    });

    const totalInvested = portfolios.reduce(
      (sum, p) => sum + BigInt(p.totalInvested),
      BigInt(0),
    );

    const totalProfit = portfolios.reduce(
      (sum, p) => sum + BigInt(p.totalProfit),
      BigInt(0),
    );

    const totalClaimed = portfolios.reduce(
      (sum, p) => sum + BigInt(p.totalClaimed),
      BigInt(0),
    );

    const totalActiveInvestments = portfolios.reduce(
      (sum, p) => sum + p.activeInvestments,
      0,
    );

    const avgROI =
      portfolios.length > 0
        ? portfolios.reduce((sum, p) => sum + p.avgROI, 0) / portfolios.length
        : 0;

    return {
      totalInvestors: portfolios.length,
      totalInvested: totalInvested.toString(),
      totalProfit: totalProfit.toString(),
      totalClaimed: totalClaimed.toString(),
      totalActiveInvestments,
      avgROI,
    };
  }
}
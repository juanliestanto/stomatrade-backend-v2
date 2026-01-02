import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import {
  InvestmentResponseDto,
  InvestmentDetailResponseDto,
  InvestmentListResponseDto,
  ProjectStatsResponseDto,
} from './dto/investment-response.dto';
import { toWei } from '../../common/utils/wei-converter.util';

@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stomaTradeContract: StomaTradeContractService,
  ) {}

  /**
   * Extract CID from various IPFS URL formats
   */
  private extractCID(url: string): string {
    if (!url) return '';

    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', '');
    }

    const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (match) {
      return match[1];
    }

    return url;
  }

  async create(dto: CreateInvestmentDto): Promise<InvestmentResponseDto> {
    this.logger.log(
      `Creating investment for user ${dto.userId} in project ${dto.projectId}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: {
        projectSubmission: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    if (!project.tokenId) {
      throw new BadRequestException(
        'Project has not been minted on blockchain yet',
      );
    }

    // Verify project exists and is valid on blockchain
    try {
      const projectTokenId = BigInt(project.tokenId);
      const blockchainProject = await this.stomaTradeContract.getProject(projectTokenId);

      // Check if project is ACTIVE (status 0 = ACTIVE)
      if (blockchainProject.status !== 0) {
        throw new BadRequestException(
          `Project is not active on blockchain (status: ${blockchainProject.status})`,
        );
      }

      this.logger.log(`Project ${projectTokenId} verified on blockchain - Status: ACTIVE`);
    } catch (error) {
      this.logger.error(`Failed to verify project on blockchain: ${error.message}`);
      throw new BadRequestException(
        `Invalid project on blockchain: ${error.message}`,
      );
    }

    const investment = await this.prisma.investment.create({
      data: {
        userId: dto.userId,
        projectId: dto.projectId,
        amount: dto.amount,
      },
      include: {
        user: true,
        project: true,
      },
    });

    try {
      this.logger.log(
        `Calling blockchain invest() - ProjectId: ${project.tokenId}, Amount: ${dto.amount}`,
      );

      // Get investment files for CID
      const investmentFiles = await this.prisma.file.findMany({
        where: { reffId: investment.id },
      });

      const primaryFile = investmentFiles.find(f => f.type.startsWith('image/')) || investmentFiles[0];
      const cid = primaryFile?.url ? this.extractCID(primaryFile.url) : '';

      const projectTokenId = BigInt(project.tokenId);
      // Convert amount bersih ke wei untuk blockchain
      const amountInWei = toWei(dto.amount);

      const txResult = await this.stomaTradeContract.invest(
        cid,
        projectTokenId,
        amountInWei,
      );

      let receiptTokenId: number | null = null;
      if (txResult.receipt) {
        const investedEvent = this.stomaTradeContract.getEventFromReceipt(
          txResult.receipt,
          'Invested',
        );

        if (investedEvent) {
          const parsed = this.stomaTradeContract
            .getContract()
            .interface.parseLog({
              topics: investedEvent.topics,
              data: investedEvent.data,
            });

          if (parsed) {
            receiptTokenId = Number(parsed.args.receiptTokenId);
            this.logger.log(
              `Investment receipt NFT minted with token ID: ${receiptTokenId}`,
            );
          }
        }
      }

      const updatedInvestment = await this.prisma.investment.update({
        where: { id: investment.id },
        data: {
          receiptTokenId,
          transactionHash: txResult.hash,
          blockNumber: txResult.blockNumber || null,
        },
        include: {
          user: true,
          project: {
            include: {
              farmer: true,
            },
          },
        },
      });

      await this.updateUserPortfolio(dto.userId);

      this.logger.log(`Investment created successfully: ${investment.id}`);

      // Return clean response DTO
      return {
        data: {
          id: updatedInvestment.id,
          amount: updatedInvestment.amount,
          receiptTokenId: updatedInvestment.receiptTokenId,
          message: 'Investment Successfully',
          investedAt: updatedInvestment.investedAt,
          project: {
            id: updatedInvestment.project.id,
            commodity: updatedInvestment.project.commodity,
            farmerName: updatedInvestment.project.farmer?.name || 'N/A',
            targetAmount: updatedInvestment.project.volume.toString(),
          },
        },
      } as InvestmentResponseDto;
    } catch (error) {
      this.logger.error('Error processing investment on blockchain', error);

      await this.prisma.investment.delete({
        where: { id: investment.id },
      });

      throw new BadRequestException(
        `Failed to process investment on blockchain: ${error.message}`,
      );
    }
  }

  async findAll(userId?: string, projectId?: string) {
    const where: any = { deleted: false };

    if (userId) {
      where.userId = userId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    return await this.prisma.investment.findMany({
      where,
      include: {
        user: true,
        project: {
          include: {
            farmer: true,
            land: true,
          },
        },
      },
      orderBy: {
        investedAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const investment = await this.prisma.investment.findUnique({
      where: { id },
      include: {
        user: true,
        project: {
          include: {
            farmer: true,
            land: true,
            projectSubmission: true,
          },
        },
        profitClaims: true,
      },
    });

    if (!investment) {
      throw new NotFoundException(`Investment with ID ${id} not found`);
    }

    return investment;
  }

  async getProjectStats(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const investments = await this.prisma.investment.findMany({
      where: { projectId, deleted: false },
    });

    // Calculate total dari amount bersih (sudah bersih di DB)
    const totalInvested = investments.reduce(
      (sum, inv) => sum + Number(inv.amount),
      0,
    );

    const investorCount = new Set(investments.map((inv) => inv.userId)).size;

    return {
      projectId,
      totalInvestments: investments.length,
      totalInvested: totalInvested.toString(),
      uniqueInvestors: investorCount,
      investments: investments.map((inv) => ({
        id: inv.id,
        userId: inv.userId,
        amount: inv.amount,
        receiptTokenId: inv.receiptTokenId,
        investedAt: inv.investedAt,
      })),
    };
  }

  private async updateUserPortfolio(userId: string) {
    this.logger.log(`Updating portfolio for user ${userId}`);

    const investments = await this.prisma.investment.findMany({
      where: { userId, deleted: false },
      include: {
        profitClaims: true,
      },
    });

    // Calculate totals dari amount bersih (sudah bersih di DB)
    const totalInvested = investments.reduce(
      (sum, inv) => sum + Number(inv.amount),
      0,
    );

    const totalClaimed = investments.reduce((sum, inv) => {
      const claimed = inv.profitClaims.reduce(
        (claimSum, claim) => claimSum + Number(claim.amount),
        0,
      );
      return sum + claimed;
    }, 0);

    const totalProfit = totalClaimed;

    const activeInvestments = investments.filter(
      (inv) => inv.receiptTokenId !== null,
    ).length;

    const avgROI =
      totalInvested > 0
        ? (totalProfit / totalInvested) * 100
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

    this.logger.log(`Portfolio updated for user ${userId}`);
  }

  async recalculateAllPortfolios() {
    this.logger.log('Recalculating all user portfolios');

    const users = await this.prisma.user.findMany({
      where: {
        investments: {
          some: {},
        },
      },
    });

    for (const user of users) {
      await this.updateUserPortfolio(user.id);
    }

    this.logger.log(`Recalculated portfolios for ${users.length} users`);
  }
}
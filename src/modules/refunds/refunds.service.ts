import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { MarkRefundableDto } from './dto/mark-refundable.dto';
import { ClaimRefundDto } from './dto/claim-refund.dto';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stomaTradeContract: StomaTradeContractService,
  ) {}

  async markRefundable(dto: MarkRefundableDto) {
    this.logger.log(`Marking project ${dto.projectId} as refundable`);

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

    try {
      
      const projectTokenId = BigInt(project.tokenId);

      this.logger.log(
        `Calling blockchain refundProject() - ProjectId: ${projectTokenId}`,
      );

      const txResult = await this.stomaTradeContract.refundProject(projectTokenId);

      const blockchainTx = await this.prisma.blockchainTransaction.create({
        data: {
          transactionHash: txResult.hash,
          transactionType: 'REFUND',
          status: txResult.success ? 'CONFIRMED' : 'FAILED',
          fromAddress: await this.stomaTradeContract.getSignerAddress(),
          toAddress: this.stomaTradeContract.getstomatradeAddress(),
          blockNumber: txResult.blockNumber || null,
          gasUsed: txResult.gasUsed?.toString(),
          gasPrice: txResult.effectiveGasPrice?.toString(),
          eventData: JSON.stringify({
            action: 'markRefundable',
            projectId: dto.projectId,
            reason: dto.reason,
          }),
        },
      });

      this.logger.log(`Project marked as refundable: ${dto.projectId}`);

      return {
        projectId: dto.projectId,
        status: 'REFUNDABLE',
        reason: dto.reason,
        transaction: {
          id: blockchainTx.id,
          hash: txResult.hash,
          blockNumber: txResult.blockNumber,
          status: txResult.success ? 'CONFIRMED' : 'FAILED',
        },
      };
    } catch (error) {
      this.logger.error('Error marking project as refundable', error);
      throw new BadRequestException(
        `Failed to mark project as refundable: ${error.message}`,
      );
    }
  }

  async claimRefund(dto: ClaimRefundDto) {
    this.logger.log(
      `User ${dto.userId} claiming refund from project ${dto.projectId}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    if (!project.tokenId) {
      throw new BadRequestException(
        'Project has not been minted on blockchain yet',
      );
    }

    const investment = await this.prisma.investment.findFirst({
      where: {
        userId: dto.userId,
        projectId: dto.projectId,
        deleted: false,
      },
    });

    if (!investment) {
      throw new BadRequestException(
        'User has not invested in this project',
      );
    }

    try {
      
      const projectTokenId = BigInt(project.tokenId);

      this.logger.log(
        `Calling blockchain claimRefund() - ProjectId: ${projectTokenId}`,
      );

      const txResult = await this.stomaTradeContract.claimRefund(projectTokenId);

      let refundedAmount = investment.amount; 
      if (txResult.receipt) {
        const refundedEvent = this.stomaTradeContract.getEventFromReceipt(
          txResult.receipt,
          'Refunded',
        );

        if (refundedEvent) {
          const parsed = this.stomaTradeContract
            .getContract()
            .interface.parseLog({
              topics: refundedEvent.topics,
              data: refundedEvent.data,
            });

          if (parsed) {
            refundedAmount = parsed.args.amount.toString();
            this.logger.log(`Refund claimed: ${refundedAmount}`);
          }
        }
      }

      const blockchainTx = await this.prisma.blockchainTransaction.create({
        data: {
          transactionHash: txResult.hash,
          transactionType: 'REFUND',
          status: txResult.success ? 'CONFIRMED' : 'FAILED',
          fromAddress: await this.stomaTradeContract.getSignerAddress(),
          toAddress: user.walletAddress,
          blockNumber: txResult.blockNumber || null,
          gasUsed: txResult.gasUsed?.toString(),
          gasPrice: txResult.effectiveGasPrice?.toString(),
          eventData: JSON.stringify({
            action: 'claimRefund',
            userId: dto.userId,
            projectId: dto.projectId,
            amount: refundedAmount,
          }),
        },
      });

      await this.prisma.investment.update({
        where: { id: investment.id },
        data: {
          deleted: true, 
        },
      });

      await this.updateUserPortfolioAfterRefund(dto.userId);

      this.logger.log(`Refund claimed successfully: ${investment.id}`);

      return {
        investmentId: investment.id,
        userId: dto.userId,
        projectId: dto.projectId,
        refundedAmount,
        transaction: {
          id: blockchainTx.id,
          hash: txResult.hash,
          blockNumber: txResult.blockNumber,
          status: txResult.success ? 'CONFIRMED' : 'FAILED',
        },
      };
    } catch (error) {
      this.logger.error('Error claiming refund', error);
      throw new BadRequestException(
        `Failed to claim refund: ${error.message}`,
      );
    }
  }

  async getRefundableProjects() {
    
    const projects = await this.prisma.project.findMany({
      where: {
        tokenId: { not: null },
        deleted: false,
      },
      include: {
        farmer: true,
        investments: {
          where: { deleted: false },
        },
        projectSubmission: true,
      },
    });

    return projects;
  }

  async getUserRefundClaims(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const refundedInvestments = await this.prisma.investment.findMany({
      where: {
        userId,
        deleted: true,
      },
      include: {
        project: {
          include: {
            farmer: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return refundedInvestments;
  }

  private async updateUserPortfolioAfterRefund(userId: string) {
    const investments = await this.prisma.investment.findMany({
      where: { userId, deleted: false },
      include: {
        profitClaims: true,
      },
    });

    // Calculate dari amount bersih (sudah bersih di DB)
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
  }
}
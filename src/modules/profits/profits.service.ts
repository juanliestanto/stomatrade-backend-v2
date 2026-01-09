import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { DepositProfitDto } from './dto/deposit-profit.dto';
import { ClaimProfitDto } from './dto/claim-profit.dto';
import { toWei } from '../../common/utils/wei-converter.util';

@Injectable()
export class ProfitsService {
  private readonly logger = new Logger(ProfitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stomaTradeContract: StomaTradeContractService,
  ) {}

  /**
   * @deprecated Misleading method name. This actually calls withdrawProject() on the smart contract.
   *
   * IMPORTANT: Despite the name "depositProfit", this method actually withdraws project funds
   * from the blockchain after project completion. The naming confusion comes from the business
   * logic perspective (depositing to profit pool) vs blockchain operation (withdrawing from project).
   *
   * What this method does:
   * 1. Calls withdrawProject() on smart contract (NOT deposit!)
   * 2. Creates/updates profitPool record in database
   * 3. Tracks withdrawn funds as "deposited" to profit pool
   *
   * For new code, use ProjectsService.withdrawProjectFunds() instead.
   * This method is maintained for backward compatibility only.
   */
  async depositProfit(dto: DepositProfitDto) {
    this.logger.log(`[DEPRECATED] Withdrawing project funds for project ${dto.projectId}`);

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

    try {

      const projectTokenId = BigInt(project.tokenId);
      // Convert amount bersih ke wei untuk blockchain
      const amountInWei = toWei(dto.amount);

      this.logger.log(
        `⚠️ Calling blockchain withdrawProject() (not deposit!) - ProjectId: ${projectTokenId}`,
      );

      // IMPORTANT: Despite method name, this calls withdrawProject()!
      const txResult = await this.stomaTradeContract.withdrawProject(
        projectTokenId,
      );

      let profitPool = await this.prisma.profitPool.findUnique({
        where: { projectId: dto.projectId },
      });

      if (!profitPool) {
        profitPool = await this.prisma.profitPool.create({
          data: {
            projectId: dto.projectId,
            totalDeposited: dto.amount,
            totalClaimed: '0',
            remainingProfit: dto.amount,
          },
        });
      } else {
        // Calculate dari amount bersih (sudah bersih di DB)
        const newTotalDeposited =
          Number(profitPool.totalDeposited) + Number(dto.amount);
        const newRemainingProfit =
          Number(profitPool.remainingProfit) + Number(dto.amount);

        profitPool = await this.prisma.profitPool.update({
          where: { projectId: dto.projectId },
          data: {
            totalDeposited: newTotalDeposited.toString(),
            remainingProfit: newRemainingProfit.toString(),
            lastDepositAt: new Date(),
          },
        });
      }

      this.logger.log(`Profit deposited successfully for project ${dto.projectId}`);

      return {
        profitPool,
        transaction: {
          hash: txResult.hash,
          blockNumber: txResult.blockNumber,
          status: txResult.success ? 'CONFIRMED' : 'FAILED',
        },
      };
    } catch (error) {
      this.logger.error('Error depositing profit on blockchain', error);
      throw new BadRequestException(
        `Failed to deposit profit on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Note: This method calls claimWithdraw() on the smart contract.
   * The method name "claimProfit" is kept for business logic clarity and backward compatibility.
   * It represents the user-facing action (claiming profit) which maps to claimWithdraw() on chain.
   */
  async claimProfit(dto: ClaimProfitDto) {
    this.logger.log(
      `User ${dto.userId} claiming profit from project ${dto.projectId}`,
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
        `Calling blockchain claimWithdraw() - ProjectId: ${projectTokenId}`,
      );

      const txResult = await this.stomaTradeContract.claimWithdraw(projectTokenId);

      let claimedAmount = '0';
      if (txResult.receipt) {
        const profitClaimedEvent =
          this.stomaTradeContract.getEventFromReceipt(
            txResult.receipt,
            'ProfitClaimed',
          );

        if (profitClaimedEvent) {
          const parsed = this.stomaTradeContract
            .getContract()
            .interface.parseLog({
              topics: profitClaimedEvent.topics,
              data: profitClaimedEvent.data,
            });

          if (parsed) {
            claimedAmount = parsed.args.amount.toString();
            this.logger.log(`Profit claimed: ${claimedAmount}`);
          }
        }
      }

      let profitPool = await this.prisma.profitPool.findUnique({
        where: { projectId: dto.projectId },
      });

      if (!profitPool) {
        
        profitPool = await this.prisma.profitPool.create({
          data: {
            projectId: dto.projectId,
            totalDeposited: '0',
            totalClaimed: claimedAmount,
            remainingProfit: '0',
          },
        });
      } else {
        // Calculate dari amount bersih (sudah bersih di DB)
        const newTotalClaimed =
          Number(profitPool.totalClaimed) + Number(claimedAmount);
        const newRemainingProfit =
          Number(profitPool.remainingProfit) - Number(claimedAmount);

        profitPool = await this.prisma.profitPool.update({
          where: { projectId: dto.projectId },
          data: {
            totalClaimed: newTotalClaimed.toString(),
            remainingProfit: newRemainingProfit.toString(),
          },
        });
      }

      const profitClaim = await this.prisma.profitClaim.create({
        data: {
          userId: dto.userId,
          profitPoolId: profitPool.id,
          investmentId: investment.id,
          amount: claimedAmount,
          transactionHash: txResult.hash,
          blockNumber: txResult.blockNumber || null,
        },
        include: {
          user: true,
          profitPool: {
            include: {
              project: true,
            },
          },
          investment: true,
        },
      });

      this.logger.log(`Profit claimed successfully: ${profitClaim.id}`);

      return profitClaim;
    } catch (error) {
      this.logger.error('Error claiming profit on blockchain', error);
      throw new BadRequestException(
        `Failed to claim profit on blockchain: ${error.message}`,
      );
    }
  }

  async getProjectProfitPool(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const profitPool = await this.prisma.profitPool.findUnique({
      where: { projectId },
      include: {
        project: {
          include: {
            farmer: true,
          },
        },
        profitClaims: {
          include: {
            user: {
              select: {
                id: true,
                walletAddress: true,
              },
            },
          },
        },
      },
    });

    if (!profitPool) {
      return {
        projectId,
        totalDeposited: '0',
        totalClaimed: '0',
        remainingProfit: '0',
        profitClaims: [],
      };
    }

    return profitPool;
  }

  async getUserProfitClaims(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return await this.prisma.profitClaim.findMany({
      where: { userId, deleted: false },
      include: {
        profitPool: {
          include: {
            project: {
              include: {
                farmer: true,
              },
            },
          },
        },
        investment: true,
      },
      orderBy: {
        claimedAt: 'desc',
      },
    });
  }

  async getAllProfitPools() {
    return await this.prisma.profitPool.findMany({
      where: { deleted: false },
      include: {
        project: {
          include: {
            farmer: true,
          },
        },
        profitClaims: {
          select: {
            id: true,
            userId: true,
            amount: true,
            claimedAt: true,
          },
        },
      },
      orderBy: {
        totalDeposited: 'desc',
      },
    });
  }
}
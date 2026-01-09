import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { SUBMISSION_STATUS } from '@prisma/client';
import { CreateProjectSubmissionDto } from './dto/create-project-submission.dto';
import { ApproveProjectSubmissionDto } from './dto/approve-project-submission.dto';
import { RejectProjectSubmissionDto } from './dto/reject-project-submission.dto';
import { toWei } from '../../common/utils/wei-converter.util';

@Injectable()
export class ProjectSubmissionsService {
  private readonly logger = new Logger(ProjectSubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stomaTradeContract: StomaTradeContractService,
  ) {}

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

  async create(dto: CreateProjectSubmissionDto) {
    this.logger.log(`Creating project submission for project ${dto.projectId}`);

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: {
        farmer: true,
        land: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    const existingSubmission = await this.prisma.projectSubmission.findUnique({
      where: { projectId: dto.projectId },
    });

    if (existingSubmission) {
      throw new BadRequestException(
        `Project already has a submission with status: ${existingSubmission.status}`,
      );
    }

    const updateProjectData: any = {};

    if (dto.totalKilos !== undefined) {
      updateProjectData.totalKilos = parseFloat(dto.totalKilos);
    }

    if (dto.profitPerKillos !== undefined) {
      updateProjectData.profitPerKillos = parseFloat(dto.profitPerKillos);
    }

    if (dto.sharedProfit !== undefined) {
      updateProjectData.profitShare = dto.sharedProfit;
    }

    if (Object.keys(updateProjectData).length > 0) {
      await this.prisma.project.update({
        where: { id: dto.projectId },
        data: updateProjectData,
      });
      this.logger.log(`Project updated with submission data: ${JSON.stringify(updateProjectData)}`);
    }

    const submission = await this.prisma.projectSubmission.create({
      data: {
        projectId: dto.projectId,
        valueProject: dto.valueProject,
        maxCrowdFunding: dto.maxCrowdFunding,
        metadataCid: dto.metadataCid,
        submittedBy: dto.submittedBy,
        status: SUBMISSION_STATUS.SUBMITTED,
      },
      include: {
        project: {
          include: {
            farmer: true,
            land: true,
          },
        },
      },
    });

    const encodedCalldata = this.stomaTradeContract.getCreateProjectCalldata(
      dto.metadataCid || '',
      dto.valueProject,
      dto.maxCrowdFunding,
      dto.totalKilos || '0',
      dto.profitPerKillos || '0',
      dto.sharedProfit || 0,
    );

    this.logger.log(`Project submission created: ${submission.id}`);
    return {
      ...submission,
      encodedCalldata,
    };
  }

  async findAll(status?: SUBMISSION_STATUS) {
    const where = status ? { status, deleted: false } : { deleted: false };

    return await this.prisma.projectSubmission.findMany({
      where,
      include: {
        project: {
          include: {
            farmer: true,
            land: true,
          },
        },
        transaction: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const submission = await this.prisma.projectSubmission.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            farmer: true,
            land: true,
          },
        },
        transaction: true,
      },
    });

    if (!submission) {
      throw new NotFoundException(
        `Project submission with ID ${id} not found`,
      );
    }

    return submission;
  }

  async approve(id: string, dto: ApproveProjectSubmissionDto) {
    this.logger.log(`Approving project submission ${id}`);

    const submission = await this.findOne(id);

    if (submission.status !== SUBMISSION_STATUS.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve submission with status: ${submission.status}`,
      );
    }

    await this.prisma.projectSubmission.update({
      where: { id },
      data: {
        status: SUBMISSION_STATUS.APPROVED,
        approvedBy: dto.approvedBy,
      },
    });

    try {
      this.logger.log(
        `Minting Project NFT - Value: ${submission.valueProject}, MaxCrowdFunding: ${submission.maxCrowdFunding}, CID: ${submission.metadataCid || 'none'}`,
      );

      const projectFiles = await this.prisma.file.findMany({
        where: { reffId: submission.project.id },
      });

      const primaryFile = projectFiles.find(f => f.type.startsWith('image/')) || projectFiles[0];
      const cid = primaryFile?.url ? this.extractCID(primaryFile.url) : (submission.metadataCid || '');

      const valueProject = toWei(submission.valueProject);
      const maxCrowdFunding = toWei(submission.maxCrowdFunding);
      const totalKilos = toWei(submission.project.totalKilos || '0');
      const profitPerKillos = toWei(submission.project.profitPerKillos || '0');
      const sharedProfit = BigInt(submission.project.profitShare || 0);

      const txResult = await this.stomaTradeContract.createProject(
        cid,
        valueProject,
        maxCrowdFunding,
        totalKilos,
        profitPerKillos,
        sharedProfit,
      );

      const blockchainTx = await this.prisma.blockchainTransaction.create({
        data: {
          transactionHash: txResult.hash,
          transactionType: 'CREATE_PROJECT',
          status: txResult.success ? 'CONFIRMED' : 'FAILED',
          fromAddress: await this.stomaTradeContract.getSignerAddress(),
          toAddress: this.stomaTradeContract.getstomatradeAddress(),
          blockNumber: txResult.blockNumber || null,
          gasUsed: txResult.gasUsed?.toString(),
          gasPrice: txResult.effectiveGasPrice?.toString(),
        },
      });

      let mintedTokenId: number | null = null;
      if (txResult.receipt) {
        const projectCreatedEvent =
          this.stomaTradeContract.getEventFromReceipt(
            txResult.receipt,
            'ProjectCreated',
          );

        if (projectCreatedEvent) {
          const parsed = this.stomaTradeContract
            .getContract()
            .interface.parseLog({
              topics: projectCreatedEvent.topics,
              data: projectCreatedEvent.data,
            });

          if (parsed) {
            mintedTokenId = Number(parsed.args.idProject);
            this.logger.log(
              `Project NFT minted with token ID: ${mintedTokenId}`,
            );
          }
        }
      }

      const updatedSubmission = await this.prisma.projectSubmission.update({
        where: { id },
        data: {
          status: SUBMISSION_STATUS.MINTED,
          blockchainTxId: blockchainTx.id,
          mintedTokenId,
        },
        include: {
          project: {
            include: {
              farmer: true,
              land: true,
            },
          },
          transaction: true,
        },
      });

      if (mintedTokenId !== null) {
        const appProject = await this.prisma.appProject.findFirst({
          where: {
            name: 'StomaTrade',
            deleted: false,
          },
        });

        if (!appProject) {
          this.logger.error('AppProject configuration not found in database');
          throw new BadRequestException(
            'AppProject configuration not found. Cannot mint project without blockchain chain configuration.',
          );
        }

        const missingFields: string[] = [];
        if (!appProject.chainId) missingFields.push('chainId');
        if (!appProject.contractAddress) missingFields.push('contractAddress');
        if (!appProject.explorerUrl) missingFields.push('explorerUrl');

        if (missingFields.length > 0) {
          this.logger.error('AppProject has incomplete configuration', {
            missingFields,
            appProjectId: appProject.id,
          });
          throw new BadRequestException(
            `AppProject has incomplete blockchain configuration. Missing fields: ${missingFields.join(', ')}`,
          );
        }

        await this.prisma.project.update({
          where: { id: submission.projectId },
          data: {
            tokenId: mintedTokenId,
            chainId: appProject.chainId,
            contractAddress: appProject.contractAddress,
            explorerUrl: appProject.explorerUrl,
          },
        });

        this.logger.log(
          `Project updated with tokenId: ${mintedTokenId}, chainId: ${appProject.chainId}, contract: ${appProject.contractAddress}`,
        );
      }

      this.logger.log(`Project submission approved and minted: ${id}`);
      return updatedSubmission;
    } catch (error) {
      this.logger.error('Error minting Project NFT', error);

      await this.prisma.projectSubmission.update({
        where: { id },
        data: {
          status: SUBMISSION_STATUS.SUBMITTED,
          approvedBy: null,
        },
      });

      throw new BadRequestException(
        `Failed to mint Project NFT: ${error.message}`,
      );
    }
  }

  async reject(id: string, dto: RejectProjectSubmissionDto) {
    this.logger.log(`Rejecting project submission ${id}`);

    const submission = await this.findOne(id);

    if (submission.status !== SUBMISSION_STATUS.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject submission with status: ${submission.status}`,
      );
    }

    const rejectedSubmission = await this.prisma.projectSubmission.update({
      where: { id },
      data: {
        status: SUBMISSION_STATUS.REJECTED,
        approvedBy: dto.rejectedBy,
        rejectionReason: dto.rejectionReason,
      },
      include: {
        project: {
          include: {
            farmer: true,
            land: true,
          },
        },
      },
    });

    this.logger.log(`Project submission rejected: ${id}`);
    return rejectedSubmission;
  }
}
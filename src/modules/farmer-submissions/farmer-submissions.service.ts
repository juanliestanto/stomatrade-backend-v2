import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { SUBMISSION_STATUS } from '@prisma/client';
import { CreateFarmerSubmissionDto } from './dto/create-farmer-submission.dto';
import { ApproveFarmerSubmissionDto } from './dto/approve-farmer-submission.dto';
import { RejectFarmerSubmissionDto } from './dto/reject-farmer-submission.dto';

@Injectable()
export class FarmerSubmissionsService {
  private readonly logger = new Logger(FarmerSubmissionsService.name);

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

  async create(dto: CreateFarmerSubmissionDto) {
    this.logger.log(`Creating farmer submission for farmer ${dto.farmerId}`);

    const farmer = await this.prisma.farmer.findUnique({
      where: { id: dto.farmerId },
      include: { collector: true },
    });

    if (!farmer) {
      throw new NotFoundException(`Farmer with ID ${dto.farmerId} not found`);
    }

    const existingSubmission = await this.prisma.farmerSubmission.findUnique({
      where: { farmerId: dto.farmerId },
    });

    if (existingSubmission) {
      throw new BadRequestException(
        `Farmer already has a submission with status: ${existingSubmission.status}`,
      );
    }

    const submission = await this.prisma.farmerSubmission.create({
      data: {
        farmerId: dto.farmerId,
        commodity: dto.commodity,
        submittedBy: dto.submittedBy,
        status: SUBMISSION_STATUS.SUBMITTED,
      },
      include: {
        farmer: true,
      },
    });

    const encodedCalldata = this.stomaTradeContract.getMintFarmerCalldata(
      '', // CID - will be provided later
      farmer.collectorId,
      farmer.name,
      farmer.age,
      farmer.address,
    );

    this.logger.log(`Farmer submission created: ${submission.id}`);
    return {
      ...submission,
      encodedCalldata,
    };
  }

  async findAll(status?: SUBMISSION_STATUS) {
    const where = status ? { status, deleted: false } : { deleted: false };

    return await this.prisma.farmerSubmission.findMany({
      where,
      include: {
        farmer: true,
        transaction: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const submission = await this.prisma.farmerSubmission.findUnique({
      where: { id },
      include: {
        farmer: true,
        transaction: true,
      },
    });

    if (!submission) {
      throw new NotFoundException(
        `Farmer submission with ID ${id} not found`,
      );
    }

    return submission;
  }

  async approve(id: string, dto: ApproveFarmerSubmissionDto) {
    this.logger.log(`Approving farmer submission ${id}`);

    const submission = await this.findOne(id);

    if (submission.status !== SUBMISSION_STATUS.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve submission with status: ${submission.status}`,
      );
    }

    await this.prisma.farmerSubmission.update({
      where: { id },
      data: {
        status: SUBMISSION_STATUS.APPROVED,
        approvedBy: dto.approvedBy,
      },
    });

    try {
      this.logger.log(
        `Minting Farmer NFT for: ${submission.farmer.name}`,
      );

      // Get farmer files for CID
      const farmerFiles = await this.prisma.file.findMany({
        where: { reffId: submission.farmerId },
      });

      const primaryFile = farmerFiles.find(f => f.type.startsWith('image/')) || farmerFiles[0];
      let cid = primaryFile?.url ? this.extractCID(primaryFile.url) : '';

      // Validate CID - smart contract requires non-empty CID
      if (!cid || cid.trim() === '') {
        // Use placeholder CID for metadata
        // This is a valid IPFS CID hash pointing to empty/placeholder content
        cid = 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn';
        this.logger.warn(
          `No valid CID found for farmer ${submission.farmerId}, using placeholder CID`,
        );
      }

      this.logger.log(`Using CID: ${cid} for Farmer NFT`);

      const txResult = await this.stomaTradeContract.addFarmer(
        cid,
        submission.farmer.collectorId,
        submission.farmer.name,
        BigInt(submission.farmer.age),
        submission.farmer.address,
      );

      const blockchainTx = await this.prisma.blockchainTransaction.create({
        data: {
          transactionHash: txResult.hash,
          transactionType: 'MINT_FARMER_NFT',
          status: txResult.success ? 'CONFIRMED' : 'FAILED',
          fromAddress: await this.stomaTradeContract.getSignerAddress(),
          blockNumber: txResult.blockNumber || null,
          gasUsed: txResult.gasUsed?.toString(),
          gasPrice: txResult.effectiveGasPrice?.toString(),
        },
      });

      let mintedTokenId: number | null = null;
      if (txResult.receipt) {
        const farmerAddedEvent = this.stomaTradeContract.getEventFromReceipt(
          txResult.receipt,
          'FarmerAdded',
        );

        if (farmerAddedEvent) {
          const parsed = this.stomaTradeContract
            .getContract()
            .interface.parseLog({
              topics: farmerAddedEvent.topics,
              data: farmerAddedEvent.data,
            });

          if (parsed) {
            mintedTokenId = Number(parsed.args.idFarmer);
            this.logger.log(`Farmer NFT added with token ID: ${mintedTokenId}`);
          }
        }
      }

      const updatedSubmission = await this.prisma.farmerSubmission.update({
        where: { id },
        data: {
          status: SUBMISSION_STATUS.MINTED,
          blockchainTxId: blockchainTx.id,
          mintedTokenId,
        },
        include: {
          farmer: true,
          transaction: true,
        },
      });

      if (mintedTokenId !== null) {
        await this.prisma.farmer.update({
          where: { id: submission.farmerId },
          data: {
            tokenId: mintedTokenId,
          },
        });
      }

      this.logger.log(`Farmer submission approved and minted: ${id}`);
      return updatedSubmission;
    } catch (error) {
      this.logger.error('Error minting Farmer NFT', error);

      await this.prisma.farmerSubmission.update({
        where: { id },
        data: {
          status: SUBMISSION_STATUS.SUBMITTED,
          approvedBy: null,
        },
      });

      throw new BadRequestException(
        `Failed to mint Farmer NFT: ${error.message}`,
      );
    }
  }

  async reject(id: string, dto: RejectFarmerSubmissionDto) {
    this.logger.log(`Rejecting farmer submission ${id}`);

    const submission = await this.findOne(id);

    if (submission.status !== SUBMISSION_STATUS.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject submission with status: ${submission.status}`,
      );
    }

    const rejectedSubmission = await this.prisma.farmerSubmission.update({
      where: { id },
      data: {
        status: SUBMISSION_STATUS.REJECTED,
        approvedBy: dto.rejectedBy,
        rejectionReason: dto.rejectionReason,
      },
      include: {
        farmer: true,
      },
    });

    this.logger.log(`Farmer submission rejected: ${id}`);
    return rejectedSubmission;
  }
}
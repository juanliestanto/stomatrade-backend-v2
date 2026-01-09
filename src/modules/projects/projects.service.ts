import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { ProjectListResponseDto, ProjectListItemDto } from './dto/project-list-response.dto';
import { ProjectDetailResponseDto } from './dto/project-detail-response.dto';
import { PROJECT_STATUS, Prisma } from '@prisma/client';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private stomaTradeContract: StomaTradeContractService,
  ) { }

  async create(createProjectDto: CreateProjectDto): Promise<ProjectResponseDto> {
    const { sendDate, volume, ...rest } = createProjectDto;

    const res = await this.prisma.project.create({
      data: {
        ...rest,
        volume,
        totalKilos: volume,
        sendDate: new Date(sendDate),
      },
    });

    return res as ProjectResponseDto;
  }

  async findAll(query: SearchQueryDto): Promise<PaginatedResponseDto<ProjectResponseDto>> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      deleted: false,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { commodity: { contains: search, mode: 'insensitive' } },
          { farmer: { name: { contains: search, mode: 'insensitive' } } },
          { collector: { name: { contains: search, mode: 'insensitive' } } },
          { land: { address: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          farmer: true,
          collector: true,
          land: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    const items = data.map((project) => {
      const explorerNftUrl =
        project.explorerUrl && project.contractAddress && project.tokenId
          ? `${project.explorerUrl}/nft/${project.contractAddress}/${project.tokenId}`
          : null;

      return {
        ...project,
        explorerNftUrl,
      } as ProjectResponseDto;
    });

    return new PaginatedResponseDto(items, total, page, limit);
  }

  async findOne(id: string): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const explorerNftUrl =
      project.explorerUrl && project.contractAddress && project.tokenId
        ? `${project.explorerUrl}/nft/${project.contractAddress}/${project.tokenId}`
        : null;

    return {
      ...project,
      explorerNftUrl,
    } as ProjectResponseDto;
  }

  async findByFarmer(farmerId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<ProjectResponseDto>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { farmerId, deleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where: { farmerId, deleted: false } }),
    ]);

    const items = data.map((project) => {
      const explorerNftUrl =
        project.explorerUrl && project.contractAddress && project.tokenId
          ? `${project.explorerUrl}/nft/${project.contractAddress}/${project.tokenId}`
          : null;

      return {
        ...project,
        explorerNftUrl,
      } as ProjectResponseDto;
    });

    return new PaginatedResponseDto(items, total, page, limit);
  }

  async findByLand(landId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<ProjectResponseDto>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { landId, deleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where: { landId, deleted: false } }),
    ]);

    const items = data.map((project) => {
      const explorerNftUrl =
        project.explorerUrl && project.contractAddress && project.tokenId
          ? `${project.explorerUrl}/nft/${project.contractAddress}/${project.tokenId}`
          : null;

      return {
        ...project,
        explorerNftUrl,
      } as ProjectResponseDto;
    });

    return new PaginatedResponseDto(items, total, page, limit);
  }

  async update(id: string, updateProjectDto: UpdateProjectDto): Promise<ProjectResponseDto> {
    await this.findOne(id);

    const updateData: any = { ...updateProjectDto };
    if (updateProjectDto.sendDate) {
      updateData.sendDate = new Date(updateProjectDto.sendDate);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: updateData,
    });

    return updated as ProjectResponseDto;
  }

  async remove(id: string): Promise<ProjectResponseDto> {
    await this.findOne(id);

    const res = await this.prisma.project.update({
      where: { id },
      data: { deleted: true },
    });

    return res as ProjectResponseDto;
  }

  async findOngoingProjects(pagination: PaginationDto): Promise<ProjectListResponseDto> {
    this.logger.log('Fetching ongoing projects');
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          deleted: false,
          status: PROJECT_STATUS.ACTIVE,
          tokenId: { not: null },
        },
        include: {
          collector: true,
          projectSubmission: true,
          investments: {
            where: { deleted: false },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({
        where: {
          deleted: false,
          status: PROJECT_STATUS.ACTIVE,
          tokenId: { not: null },
        },
      }),
    ]);

    const items: ProjectListItemDto[] = await Promise.all(
      projects.map(async (project) => {
        const file = await this.prisma.file.findFirst({
          where: {
            reffId: project.id,
            deleted: false,
          },
          orderBy: { createdAt: 'desc' },
        });

        const totalFunding = project.investments.reduce(
          (sum, inv) => sum + BigInt(inv.amount),
          BigInt(0),
        );

        const uniqueInvestors = new Set(project.investments.map(inv => inv.userId)).size;

        const maxFunding = BigInt(project.projectSubmission?.maxCrowdFunding || '0');
        const fundingPercentage = maxFunding > BigInt(0)
          ? (Number(totalFunding) / Number(maxFunding)) * 100
          : 0;

        const explorerNftUrl =
          project.explorerUrl && project.contractAddress && project.tokenId
            ? `${project.explorerUrl}/nft/${project.contractAddress}/${project.tokenId}`
            : null;

        return {
          projectId: project.id,
          projectName: project.name,
          projectCompany: project.collector.name,
          totalFunding: totalFunding.toString(),
          fundingPrice: project.projectSubmission?.maxCrowdFunding || '0',
          investors: uniqueInvestors,
          margin: project.profitShare,
          image: file?.url || null,
          status: project.status,
          fundingPercentage: Math.round(fundingPercentage * 100) / 100,
          tokenId: project.tokenId,
          chainId: project.chainId,
          contractAddress: project.contractAddress,
          explorerNftUrl,
        };
      }),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getProjectDetail(id: string): Promise<ProjectDetailResponseDto> {
    this.logger.log(`Fetching detailed information for project ${id}`);

    const project = await this.prisma.project.findFirst({
      where: { id, deleted: false },
      include: {
        collector: true,
        farmer: true,
        land: true,
        projectSubmission: true,
        investments: {
          where: { deleted: false },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

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

    const uniqueInvestors = new Set(project.investments.map(inv => inv.userId)).size;

    const maxFunding = BigInt(project.projectSubmission?.maxCrowdFunding || '0');
    const fundingPercentage = maxFunding > BigInt(0)
      ? (Number(currentFunding) / Number(maxFunding)) * 100
      : 0;

    const explorerNftUrl =
      project.explorerUrl && project.contractAddress && project.tokenId
        ? `${project.explorerUrl}/nft/${project.contractAddress}/${project.tokenId}`
        : null;

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
      tokenId: project.tokenId,
      chainId: project.chainId,
      contractAddress: project.contractAddress,
      explorerNftUrl,
    };
  }

  async closeProject(projectId: string): Promise<{ message: string; transactionHash: string }> {
    this.logger.log(`Closing project ${projectId}`);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (!project.tokenId) {
      throw new BadRequestException('Project has not been minted on blockchain yet');
    }

    if (project.status === PROJECT_STATUS.CLOSED) {
      throw new BadRequestException('Project is already closed');
    }

    const txResult = await this.stomaTradeContract.closeProject(BigInt(project.tokenId));

    if (!txResult.success) {
      throw new BadRequestException('Failed to close project on blockchain');
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: PROJECT_STATUS.CLOSED },
    });

    this.logger.log(`Project ${projectId} closed successfully. TxHash: ${txResult.hash}`);

    return {
      message: 'Project closed successfully',
      transactionHash: txResult.hash,
    };
  }

  async finishProject(projectId: string): Promise<{ message: string; transactionHash: string }> {
    this.logger.log(`Finishing project ${projectId}`);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (!project.tokenId) {
      throw new BadRequestException('Project has not been minted on blockchain yet');
    }

    if (project.status === PROJECT_STATUS.SUCCESS) {
      throw new BadRequestException('Project is already finished');
    }

    const txResult = await this.stomaTradeContract.finishProject(BigInt(project.tokenId));

    if (!txResult.success) {
      throw new BadRequestException('Failed to finish project on blockchain');
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: PROJECT_STATUS.SUCCESS },
    });

    this.logger.log(`Project ${projectId} finished successfully. TxHash: ${txResult.hash}`);

    return {
      message: 'Project finished successfully',
      transactionHash: txResult.hash,
    };
  }

  async withdrawProjectFunds(projectId: string): Promise<{ message: string; transactionHash: string }> {
    this.logger.log(`Withdrawing funds for project ${projectId}`);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (!project.tokenId) {
      throw new BadRequestException('Project has not been minted on blockchain yet');
    }

    if (project.status !== PROJECT_STATUS.SUCCESS && project.status !== PROJECT_STATUS.CLOSED) {
      throw new BadRequestException('Project must be finished or closed before withdrawing funds');
    }

    const txResult = await this.stomaTradeContract.withdrawProject(BigInt(project.tokenId));

    if (!txResult.success) {
      throw new BadRequestException('Failed to withdraw project funds');
    }

    this.logger.log(`Project ${projectId} funds withdrawn. TxHash: ${txResult.hash}`);

    return {
      message: 'Project funds withdrawn successfully',
      transactionHash: txResult.hash,
    };
  }

  async refundProject(projectId: string): Promise<{ message: string; transactionHash: string }> {
    this.logger.log(`Enabling refunds for project ${projectId}`);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (!project.tokenId) {
      throw new BadRequestException('Project has not been minted on blockchain yet');
    }

    if (project.status === PROJECT_STATUS.REFUNDING) {
      throw new BadRequestException('Project is already in refunding state');
    }

    const txResult = await this.stomaTradeContract.refundProject(BigInt(project.tokenId));

    if (!txResult.success) {
      throw new BadRequestException('Failed to enable refunds on blockchain');
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: PROJECT_STATUS.REFUNDING },
    });

    this.logger.log(`Project ${projectId} marked for refund. TxHash: ${txResult.hash}`);

    return {
      message: 'Project marked for refund successfully',
      transactionHash: txResult.hash,
    };
  }

  async claimRefund(projectId: string, userId: string): Promise<{ message: string; transactionHash: string }> {
    this.logger.log(`User ${userId} claiming refund for project ${projectId}`);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (!project.tokenId) {
      throw new BadRequestException('Project has not been minted on blockchain yet');
    }

    if (project.status !== PROJECT_STATUS.REFUNDING) {
      throw new BadRequestException('Project is not in refunding state');
    }

    const investment = await this.prisma.investment.findFirst({
      where: {
        userId,
        projectId,
        deleted: false,
      },
    });

    if (!investment) {
      throw new BadRequestException('User has no investment in this project');
    }

    const txResult = await this.stomaTradeContract.claimRefund(BigInt(project.tokenId));

    if (!txResult.success) {
      throw new BadRequestException('Failed to claim refund');
    }

    this.logger.log(`Refund claimed for project ${projectId} by user ${userId}. TxHash: ${txResult.hash}`);

    return {
      message: 'Refund claimed successfully',
      transactionHash: txResult.hash,
    };
  }
}
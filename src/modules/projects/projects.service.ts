import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { ProjectListResponseDto, ProjectListItemDto } from './dto/project-list-response.dto';
import { ProjectDetailResponseDto } from './dto/project-detail-response.dto';
import { PROJECT_STATUS } from '@prisma/client';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private prisma: PrismaService) { }

  async create(createProjectDto: CreateProjectDto): Promise<ProjectResponseDto> {
    const { sendDate, volume, ...rest } = createProjectDto;

    const res = await this.prisma.project.create({
      data: {
        ...rest,
        volume,
        totalKilos: volume, // Set totalKilos sama dengan volume
        sendDate: new Date(sendDate),
      },
    });

    return res as ProjectResponseDto;
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<ProjectResponseDto>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { deleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where: { deleted: false } }),
    ]);

    return new PaginatedResponseDto(data as ProjectResponseDto[], total, page, limit);
  }

  async findOne(id: string): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, deleted: false },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project as ProjectResponseDto;
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

    return new PaginatedResponseDto(data as ProjectResponseDto[], total, page, limit);
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

    return new PaginatedResponseDto(data as ProjectResponseDto[], total, page, limit);
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
          tokenId: { not: null }, // Only projects that have been minted
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

    // Process each project to get additional data
    const items: ProjectListItemDto[] = await Promise.all(
      projects.map(async (project) => {
        // Get project image from files
        const file = await this.prisma.file.findFirst({
          where: {
            reffId: project.id,
            deleted: false,
          },
          orderBy: { createdAt: 'desc' },
        });

        // Calculate total funding from investments
        const totalFunding = project.investments.reduce(
          (sum, inv) => sum + BigInt(inv.amount),
          BigInt(0),
        );

        // Get unique investors count
        const uniqueInvestors = new Set(project.investments.map(inv => inv.userId)).size;

        const maxFunding = BigInt(project.projectSubmission?.maxCrowdFunding || '0');
        const fundingPercentage = maxFunding > BigInt(0)
          ? (Number(totalFunding) / Number(maxFunding)) * 100
          : 0;

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

    // Get project image
    const file = await this.prisma.file.findFirst({
      where: {
        reffId: project.id,
        deleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate current funding
    const currentFunding = project.investments.reduce(
      (sum, inv) => sum + BigInt(inv.amount),
      BigInt(0),
    );

    // Get unique investors count
    const uniqueInvestors = new Set(project.investments.map(inv => inv.userId)).size;

    const maxFunding = BigInt(project.projectSubmission?.maxCrowdFunding || '0');
    const fundingPercentage = maxFunding > BigInt(0)
      ? (Number(currentFunding) / Number(maxFunding)) * 100
      : 0;

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
      gradeQuality: null, // Will be added if needed in schema
    };
  }
}
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  ProjectResponseDto,
  PaginatedProjectResponseDto,
} from './dto/project-response.dto';
import { ProjectListResponseDto } from './dto/project-list-response.dto';
import { ProjectDetailResponseDto } from './dto/project-detail-response.dto';
import { ClaimRefundDto } from './dto/claim-refund.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ROLES } from '@prisma/client';

@ApiTags('Projects')
@ApiBearerAuth('JWT-auth')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Roles(ROLES.ADMIN, ROLES.STAFF, ROLES.COLLECTOR)
  @Post()
  @ApiOperation({
    summary: 'Create a new project (Admin/Staff/Collector only)',
    description: 'Create an agricultural project for crowdfunding',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Project created successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Farmer or Land not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  create(@Body() createProjectDto: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.projectsService.create(createProjectDto);
  }

  @Public()
  @Get('ongoing')
  @ApiOperation({
    summary: 'Get ongoing projects (Public)',
    description: 'Retrieve list of active ongoing projects available for investment',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ongoing projects retrieved successfully',
    type: ProjectListResponseDto,
  })
  findOngoingProjects(@Query() pagination: PaginationDto): Promise<ProjectListResponseDto> {
    return this.projectsService.findOngoingProjects(pagination);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all projects (Public)',
    description: 'Retrieve paginated list of all agricultural projects with optional search',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term (searches name, commodity, farmer name, collector name)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Projects retrieved successfully',
    type: PaginatedProjectResponseDto,
  })
  findAll(@Query() query: SearchQueryDto): Promise<PaginatedProjectResponseDto> {
    return this.projectsService.findAll(query);
  }

  @Get('farmer/:farmerId')
  @ApiOperation({
    summary: 'Get projects by farmer',
    description: 'Retrieve all projects belonging to a specific farmer',
  })
  @ApiParam({
    name: 'farmerId',
    description: 'Farmer UUID',
    example: '770e8400-e29b-41d4-a716-446655440002',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Projects retrieved successfully',
    type: PaginatedProjectResponseDto,
  })
  findByFarmer(
    @Param('farmerId', ParseUUIDPipe) farmerId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedProjectResponseDto> {
    return this.projectsService.findByFarmer(farmerId, pagination);
  }

  @Get('land/:landId')
  @ApiOperation({
    summary: 'Get projects by land',
    description: 'Retrieve all projects on a specific land plot',
  })
  @ApiParam({
    name: 'landId',
    description: 'Land UUID',
    example: '880e8400-e29b-41d4-a716-446655440003',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Projects retrieved successfully',
    type: PaginatedProjectResponseDto,
  })
  findByLand(
    @Param('landId', ParseUUIDPipe) landId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedProjectResponseDto> {
    return this.projectsService.findByLand(landId, pagination);
  }

  @Public()
  @Get(':id/detail')
  @ApiOperation({
    summary: 'Get detailed project information (Public)',
    description: 'Retrieve comprehensive project details including funding status, investors, and dates',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
    example: 'cc0e8400-e29b-41d4-a716-446655440007',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project detail retrieved successfully',
    type: ProjectDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  getProjectDetail(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectDetailResponseDto> {
    return this.projectsService.getProjectDetail(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get project by ID',
    description: 'Retrieve a single project by UUID',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
    example: 'cc0e8400-e29b-41d4-a716-446655440007',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project retrieved successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(id);
  }

  @Roles(ROLES.ADMIN, ROLES.STAFF)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update project (Admin/Staff only)',
    description: 'Update project details',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project updated successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Roles(ROLES.ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete project (Admin only)',
    description: 'Soft delete a project',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project deleted successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectResponseDto> {
    return this.projectsService.remove(id);
  }

  // ============ LIFECYCLE MANAGEMENT ENDPOINTS ============

  @Roles(ROLES.ADMIN)
  @Post(':id/close')
  @ApiOperation({
    summary: 'Close project crowdfunding (Admin only)',
    description: 'Close crowdfunding period, preventing new investments',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project closed successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project not minted or already closed',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  closeProject(@Param('id', ParseUUIDPipe) id: string): Promise<TransactionResponseDto> {
    return this.projectsService.closeProject(id);
  }

  @Roles(ROLES.ADMIN)
  @Post(':id/finish')
  @ApiOperation({
    summary: 'Finish project (Admin only)',
    description: 'Mark project as completed after harvest/production',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project finished successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project not minted or already finished',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  finishProject(@Param('id', ParseUUIDPipe) id: string): Promise<TransactionResponseDto> {
    return this.projectsService.finishProject(id);
  }

  @Roles(ROLES.ADMIN)
  @Post(':id/withdraw-funds')
  @ApiOperation({
    summary: 'Withdraw project funds (Admin only)',
    description: 'Project owner withdraws raised crowdfunding proceeds',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project funds withdrawn successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project not minted or not in correct state',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  withdrawProjectFunds(@Param('id', ParseUUIDPipe) id: string): Promise<TransactionResponseDto> {
    return this.projectsService.withdrawProjectFunds(id);
  }

  @Roles(ROLES.ADMIN)
  @Post(':id/refund')
  @ApiOperation({
    summary: 'Enable refunds for failed project (Admin only)',
    description: 'Mark project as failed, allowing investors to claim refunds',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project marked for refund successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project not minted or already in refunding state',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  refundProject(@Param('id', ParseUUIDPipe) id: string): Promise<TransactionResponseDto> {
    return this.projectsService.refundProject(id);
  }

  @Post(':id/claim-refund')
  @ApiOperation({
    summary: 'Claim refund from failed project',
    description: 'Investor claims refund for their investment in failed project',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
  })
  @ApiBody({
    type: ClaimRefundDto,
    description: 'User ID claiming the refund',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund claimed successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project not in refunding state or user has no investment',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  claimRefund(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: ClaimRefundDto,
  ): Promise<TransactionResponseDto> {
    return this.projectsService.claimRefund(projectId, dto.userId);
  }
}
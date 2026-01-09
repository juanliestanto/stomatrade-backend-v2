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
} from '@nestjs/swagger';
import { FarmersService } from './farmers.service';
import { CreateFarmerDto } from './dto/create-farmer.dto';
import { UpdateFarmerDto } from './dto/update-farmer.dto';
import {
  FarmerResponseDto,
  PaginatedFarmerResponseDto,
} from './dto/farmer-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROLES } from '@prisma/client';

@ApiTags('Farmers')
@ApiBearerAuth('JWT-auth')
@Controller('farmers')
export class FarmersController {
  constructor(private readonly farmersService: FarmersService) {}

  @Roles(ROLES.COLLECTOR, ROLES.STAFF, ROLES.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Create a new farmer (Collector/Staff/Admin only)',
    description: 'Register a new farmer under a collector',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Farmer created successfully',
    type: FarmerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or NIK already exists',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Collector not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  create(@Body() createFarmerDto: CreateFarmerDto): Promise<FarmerResponseDto> {
    const res = this.farmersService.create(createFarmerDto);

    return res;
  }

  @Roles(ROLES.STAFF, ROLES.ADMIN)
  @Get()
  @ApiOperation({
    summary: 'Get all farmers (Staff/Admin only)',
    description: 'Retrieve paginated list of all farmers with optional search',
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
    description: 'Search term (searches name, NIK, address, collector name)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmers retrieved successfully',
    type: PaginatedFarmerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  findAll(@Query() query: SearchQueryDto): Promise<PaginatedFarmerResponseDto> {
    return this.farmersService.findAll(query);
  }

  @Get('collector/:collectorId')
  @ApiOperation({
    summary: 'Get farmers by collector',
    description: 'Retrieve all farmers under a specific collector',
  })
  @ApiParam({
    name: 'collectorId',
    description: 'Collector UUID',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmers retrieved successfully',
    type: PaginatedFarmerResponseDto,
  })
  findByCollector(
    @Param('collectorId', ParseUUIDPipe) collectorId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedFarmerResponseDto> {
    return this.farmersService.findByCollector(collectorId, pagination);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get farmer by ID',
    description: 'Retrieve a single farmer by UUID',
  })
  @ApiParam({
    name: 'id',
    description: 'Farmer UUID',
    example: '770e8400-e29b-41d4-a716-446655440002',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmer retrieved successfully',
    type: FarmerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Farmer not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<FarmerResponseDto> {
    return this.farmersService.findOne(id);
  }

  @Roles(ROLES.STAFF, ROLES.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update farmer (Staff/Admin only)',
    description: 'Update farmer details',
  })
  @ApiParam({
    name: 'id',
    description: 'Farmer UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmer updated successfully',
    type: FarmerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Farmer not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFarmerDto: UpdateFarmerDto,
  ): Promise<FarmerResponseDto> {
    return this.farmersService.update(id, updateFarmerDto);
  }

  @Roles(ROLES.ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete farmer (Admin only)',
    description: 'Soft delete a farmer',
  })
  @ApiParam({
    name: 'id',
    description: 'Farmer UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmer deleted successfully',
    type: FarmerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Farmer not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<FarmerResponseDto> {
    return this.farmersService.remove(id);
  }
}
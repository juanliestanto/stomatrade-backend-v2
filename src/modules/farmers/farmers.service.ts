import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFarmerDto } from './dto/create-farmer.dto';
import { UpdateFarmerDto } from './dto/update-farmer.dto';
import { FarmerResponseDto } from './dto/farmer-response.dto';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class FarmersService {
  constructor(private prisma: PrismaService) {}

  async create(createFarmerDto: CreateFarmerDto): Promise<FarmerResponseDto> {
    try {
      const res =await this.prisma.farmer.create({
        data: createFarmerDto,
      });

      return {
        ...res
      }
    } catch (error) {
      throw new Error(error.message);
    }
    
  }

  async findAll(query: SearchQueryDto): Promise<PaginatedResponseDto<FarmerResponseDto>> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // Build where clause with search functionality
    const where: Prisma.FarmerWhereInput = {
      deleted: false,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { nik: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { collector: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.farmer.findMany({
        where,
        include: {
          collector: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.farmer.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<FarmerResponseDto> {
    const farmer = await this.prisma.farmer.findUnique({
      where: { id, deleted: false },
    });

    if (!farmer) {
      throw new NotFoundException(`Farmer with ID ${id} not found`);
    }

    return farmer;
  }

  async findByCollector(collectorId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<FarmerResponseDto>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.farmer.findMany({
        where: { collectorId, deleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.farmer.count({ where: { collectorId, deleted: false } }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async update(id: string, updateFarmerDto: UpdateFarmerDto): Promise<FarmerResponseDto> {
    await this.findOne(id);

    return this.prisma.farmer.update({
      where: { id },
      data: updateFarmerDto,
    });
  }

  async remove(id: string): Promise<FarmerResponseDto> {
    await this.findOne(id);

    return this.prisma.farmer.update({
      where: { id },
      data: { deleted: true },
    });
  }
}
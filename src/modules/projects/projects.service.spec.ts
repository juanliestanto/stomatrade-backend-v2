import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { mockPrismaService } from '../../test/mocks/prisma.mock';
import { PROJECT_STATUS } from '@prisma/client';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: typeof mockPrismaService;
  let stomaTradeContract: jest.Mocked<StomaTradeContractService>;

  const mockProject = {
    id: 'project-uuid-1',
    tokenId: null,
    collectorId: 'collector-uuid-1',
    commodity: 'Rice',
    volume: 1000.5,
    volumeDecimal: 18,
    profitShare: 20,
    name: 'Rice Harvest',
    farmerId: 'farmer-uuid-1',
    landId: 'land-uuid-1',
    sendDate: new Date('2025-02-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
    status: PROJECT_STATUS.ACTIVE,
    totalKilos: 1000.5,
  };

  const mockMintedProject = {
    ...mockProject,
    tokenId: 1001,
  };

  const mockTransactionResult = {
    hash: '0x1234567890abcdef',
    receipt: {} as any,
    success: true,
    blockNumber: 12345,
    gasUsed: BigInt(21000),
    effectiveGasPrice: BigInt(20000000000),
  };

  const mockStomaTradeContract = {
    closeProject: jest.fn(),
    finishProject: jest.fn(),
    withdrawProject: jest.fn(),
    refundProject: jest.fn(),
    claimRefund: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StomaTradeContractService,
          useValue: mockStomaTradeContract,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = mockPrismaService;
    stomaTradeContract = module.get(StomaTradeContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const createDto = {
        collectorId: 'collector-uuid-1',
        commodity: 'Rice',
        volume: 1000.5,
        volumeDecimal: 18,
        profitShare: 20,
        name: 'Rice Harvest',
        farmerId: 'farmer-uuid-1',
        landId: 'land-uuid-1',
        sendDate: '2025-02-15T08:00:00.000Z',
      };

      prisma.project.create.mockResolvedValue(mockProject);

      const result = await service.create(createDto);

      expect(prisma.project.create).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });
  });

  describe('findAll', () => {
    it('should return paginated projects', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject]);
      prisma.project.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findByFarmer', () => {
    it('should return projects by farmer id', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject]);
      prisma.project.count.mockResolvedValue(1);

      const result = await service.findByFarmer('farmer-uuid-1', {
        page: 1,
        limit: 10,
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { farmerId: 'farmer-uuid-1', deleted: false },
        }),
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findByLand', () => {
    it('should return projects by land id', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject]);
      prisma.project.count.mockResolvedValue(1);

      const result = await service.findByLand('land-uuid-1', {
        page: 1,
        limit: 10,
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { landId: 'land-uuid-1', deleted: false },
        }),
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject);

      const result = await service.findOne('project-uuid-1');

      expect(result).toEqual({
        ...mockProject,
        explorerNftUrl: null, // Generated field based on project data
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const updateDto = { commodity: 'Premium Rice' };
      const updated = { ...mockProject, commodity: 'Premium Rice' };

      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.project.update.mockResolvedValue(updated);

      const result = await service.update('project-uuid-1', updateDto);

      expect(result.commodity).toBe('Premium Rice');
    });
  });

  describe('remove', () => {
    it('should soft delete a project', async () => {
      const deleted = { ...mockProject, deleted: true };

      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.project.update.mockResolvedValue(deleted);

      const result = await service.remove('project-uuid-1');

      expect(result.deleted).toBe(true);
    });
  });

  // ============ LIFECYCLE MANAGEMENT TESTS ============

  describe('closeProject', () => {
    it('should close a project successfully', async () => {
      prisma.project.findFirst.mockResolvedValue(mockMintedProject);
      stomaTradeContract.closeProject.mockResolvedValue(mockTransactionResult);
      prisma.project.update.mockResolvedValue({
        ...mockMintedProject,
        status: PROJECT_STATUS.CLOSED,
      });

      const result = await service.closeProject('project-uuid-1');

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-uuid-1', deleted: false },
      });
      expect(stomaTradeContract.closeProject).toHaveBeenCalledWith(BigInt(1001));
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-uuid-1' },
        data: { status: PROJECT_STATUS.CLOSED },
      });
      expect(result.message).toBe('Project closed successfully');
      expect(result.transactionHash).toBe('0x1234567890abcdef');
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.closeProject('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if project not minted', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject);

      await expect(service.closeProject('project-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if project already closed', async () => {
      prisma.project.findFirst.mockResolvedValue({
        ...mockMintedProject,
        status: PROJECT_STATUS.CLOSED,
      });

      await expect(service.closeProject('project-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if blockchain transaction fails', async () => {
      prisma.project.findFirst.mockResolvedValue(mockMintedProject);
      stomaTradeContract.closeProject.mockResolvedValue({
        ...mockTransactionResult,
        success: false,
      });

      await expect(service.closeProject('project-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('finishProject', () => {
    it('should finish a project successfully', async () => {
      prisma.project.findFirst.mockResolvedValue(mockMintedProject);
      stomaTradeContract.finishProject.mockResolvedValue(mockTransactionResult);
      prisma.project.update.mockResolvedValue({
        ...mockMintedProject,
        status: PROJECT_STATUS.SUCCESS,
      });

      const result = await service.finishProject('project-uuid-1');

      expect(stomaTradeContract.finishProject).toHaveBeenCalledWith(BigInt(1001));
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-uuid-1' },
        data: { status: PROJECT_STATUS.SUCCESS },
      });
      expect(result.message).toBe('Project finished successfully');
      expect(result.transactionHash).toBe('0x1234567890abcdef');
    });

    it('should throw BadRequestException if project already finished', async () => {
      prisma.project.findFirst.mockResolvedValue({
        ...mockMintedProject,
        status: PROJECT_STATUS.SUCCESS,
      });

      await expect(service.finishProject('project-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('withdrawProjectFunds', () => {
    it('should withdraw project funds successfully', async () => {
      const closedProject = {
        ...mockMintedProject,
        status: PROJECT_STATUS.CLOSED,
      };
      prisma.project.findFirst.mockResolvedValue(closedProject);
      stomaTradeContract.withdrawProject.mockResolvedValue(mockTransactionResult);

      const result = await service.withdrawProjectFunds('project-uuid-1');

      expect(stomaTradeContract.withdrawProject).toHaveBeenCalledWith(BigInt(1001));
      expect(result.message).toBe('Project funds withdrawn successfully');
      expect(result.transactionHash).toBe('0x1234567890abcdef');
    });

    it('should allow withdrawal for SUCCESS status', async () => {
      const successProject = {
        ...mockMintedProject,
        status: PROJECT_STATUS.SUCCESS,
      };
      prisma.project.findFirst.mockResolvedValue(successProject);
      stomaTradeContract.withdrawProject.mockResolvedValue(mockTransactionResult);

      const result = await service.withdrawProjectFunds('project-uuid-1');

      expect(result.message).toBe('Project funds withdrawn successfully');
    });

    it('should throw BadRequestException if project status is invalid', async () => {
      prisma.project.findFirst.mockResolvedValue(mockMintedProject); // ACTIVE status

      await expect(
        service.withdrawProjectFunds('project-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundProject', () => {
    it('should enable refunds for a project successfully', async () => {
      prisma.project.findFirst.mockResolvedValue(mockMintedProject);
      stomaTradeContract.refundProject.mockResolvedValue(mockTransactionResult);
      prisma.project.update.mockResolvedValue({
        ...mockMintedProject,
        status: PROJECT_STATUS.REFUNDING,
      });

      const result = await service.refundProject('project-uuid-1');

      expect(stomaTradeContract.refundProject).toHaveBeenCalledWith(BigInt(1001));
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-uuid-1' },
        data: { status: PROJECT_STATUS.REFUNDING },
      });
      expect(result.message).toBe('Project marked for refund successfully');
      expect(result.transactionHash).toBe('0x1234567890abcdef');
    });

    it('should throw BadRequestException if project already in refunding state', async () => {
      prisma.project.findFirst.mockResolvedValue({
        ...mockMintedProject,
        status: PROJECT_STATUS.REFUNDING,
      });

      await expect(service.refundProject('project-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('claimRefund', () => {
    const mockInvestment = {
      id: 'investment-uuid-1',
      userId: 'user-uuid-1',
      projectId: 'project-uuid-1',
      amount: '100000',
      deleted: false,
    };

    it('should allow investor to claim refund successfully', async () => {
      const refundingProject = {
        ...mockMintedProject,
        status: PROJECT_STATUS.REFUNDING,
      };
      prisma.project.findFirst.mockResolvedValue(refundingProject);
      prisma.investment.findFirst.mockResolvedValue(mockInvestment);
      stomaTradeContract.claimRefund.mockResolvedValue(mockTransactionResult);

      const result = await service.claimRefund('project-uuid-1', 'user-uuid-1');

      expect(prisma.investment.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-uuid-1',
          projectId: 'project-uuid-1',
          deleted: false,
        },
      });
      expect(stomaTradeContract.claimRefund).toHaveBeenCalledWith(BigInt(1001));
      expect(result.message).toBe('Refund claimed successfully');
      expect(result.transactionHash).toBe('0x1234567890abcdef');
    });

    it('should throw BadRequestException if project not in refunding state', async () => {
      prisma.project.findFirst.mockResolvedValue(mockMintedProject);

      await expect(
        service.claimRefund('project-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user has no investment', async () => {
      const refundingProject = {
        ...mockMintedProject,
        status: PROJECT_STATUS.REFUNDING,
      };
      prisma.project.findFirst.mockResolvedValue(refundingProject);
      prisma.investment.findFirst.mockResolvedValue(null);

      await expect(
        service.claimRefund('project-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});


import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { mockPrismaService } from '../../test/mocks/prisma.mock';
import { mockStomaTradeContractService } from '../../test/mocks/blockchain.mock';

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  let prisma: typeof mockPrismaService;
  let contractService: typeof mockStomaTradeContractService;

  const mockUser = {
    id: 'user-uuid-1',
    walletAddress: '0xInvestorWallet',
    role: 'INVESTOR',
  };

  const mockFarmer = {
    id: 'farmer-uuid-1',
    name: 'Pak Budi',
    age: 45,
  };

  const mockProject = {
    id: 'project-uuid-1',
    tokenId: 3001,
    commodity: 'Rice',
    volume: 1000,
    projectSubmission: {},
    farmer: mockFarmer,
  };

  const mockInvestment = {
    id: 'investment-uuid-1',
    userId: 'user-uuid-1',
    projectId: 'project-uuid-1',
    amount: '100000000000000000000',
    receiptTokenId: 4001,
    transactionHash: '0xTxHash',
    blockNumber: 12345678,
    investedAt: new Date(),
    user: mockUser,
    project: mockProject,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StomaTradeContractService,
          useValue: mockStomaTradeContractService,
        },
      ],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
    prisma = mockPrismaService;
    contractService = mockStomaTradeContractService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an investment and call blockchain', async () => {
      const createDto = {
        userId: 'user-uuid-1',
        projectId: 'project-uuid-1',
        amount: '100000000000000000000',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.investment.create.mockResolvedValue({
        ...mockInvestment,
        receiptTokenId: null,
      });
      prisma.investment.update.mockResolvedValue(mockInvestment);
      prisma.investmentPortfolio.upsert.mockResolvedValue({});
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.file.findMany.mockResolvedValue([]);

      contractService.invest.mockResolvedValue({
        hash: '0xTxHash',
        receipt: { status: 1, logs: [] },
        success: true,
        blockNumber: 12345678,
      });
      contractService.getContract.mockReturnValue({
        interface: {
          parseLog: jest.fn().mockReturnValue({
            name: 'Invested',
            args: { receiptTokenId: BigInt(4001) },
          }),
        },
      });
      contractService.getEventFromReceipt.mockReturnValue({
        topics: ['0xtopic1'],
        data: '0xdata',
      });

      const result = await service.create(createDto);

      expect(contractService.invest).toHaveBeenCalled();
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('investment-uuid-1');
      expect(result.data.amount).toBe('100000000000000000000');
      expect(result.data.receiptTokenId).toBe(4001);
      expect(result.data.message).toBe('Investment Successfully');
      expect(result.data.investedAt).toBeDefined();
      expect(result.data.project.commodity).toBe('Rice');
      expect(result.data.project.farmerName).toBe('Pak Budi');
      expect(result.data.project.targetAmount).toBe('1000');
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          userId: 'non-existent',
          projectId: 'project-uuid-1',
          amount: '100',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          userId: 'user-uuid-1',
          projectId: 'non-existent',
          amount: '100',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if project has no tokenId', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue({ ...mockProject, tokenId: null });

      await expect(
        service.create({
          userId: 'user-uuid-1',
          projectId: 'project-uuid-1',
          amount: '100',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all investments', async () => {
      prisma.investment.findMany.mockResolvedValue([mockInvestment]);

      const result = await service.findAll();

      expect(prisma.investment.findMany).toHaveBeenCalledWith({
        where: { deleted: false },
        include: expect.any(Object),
        orderBy: { investedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by userId', async () => {
      prisma.investment.findMany.mockResolvedValue([mockInvestment]);

      await service.findAll('user-uuid-1');

      expect(prisma.investment.findMany).toHaveBeenCalledWith({
        where: { deleted: false, userId: 'user-uuid-1' },
        include: expect.any(Object),
        orderBy: { investedAt: 'desc' },
      });
    });

    it('should filter by projectId', async () => {
      prisma.investment.findMany.mockResolvedValue([mockInvestment]);

      await service.findAll(undefined, 'project-uuid-1');

      expect(prisma.investment.findMany).toHaveBeenCalledWith({
        where: { deleted: false, projectId: 'project-uuid-1' },
        include: expect.any(Object),
        orderBy: { investedAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return an investment by id', async () => {
      prisma.investment.findUnique.mockResolvedValue(mockInvestment);

      const result = await service.findOne('investment-uuid-1');

      expect(result).toEqual(mockInvestment);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.investment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProjectStats', () => {
    it('should return project investment statistics', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.investment.findMany.mockResolvedValue([mockInvestment]);

      const result = await service.getProjectStats('project-uuid-1');

      expect(result).toHaveProperty('projectId', 'project-uuid-1');
      expect(result).toHaveProperty('totalInvestments', 1);
      expect(result).toHaveProperty('uniqueInvestors', 1);
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectStats('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('recalculateAllPortfolios', () => {
    it('should recalculate all portfolios', async () => {
      const mockUsers = [{ id: 'user-1' }, { id: 'user-2' }];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.investmentPortfolio.upsert.mockResolvedValue({});

      await service.recalculateAllPortfolios();

      expect(prisma.user.findMany).toHaveBeenCalled();
      expect(prisma.investmentPortfolio.upsert).toHaveBeenCalledTimes(2);
    });
  });
});

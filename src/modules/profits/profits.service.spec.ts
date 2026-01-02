import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProfitsService } from './profits.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { mockPrismaService } from '../../test/mocks/prisma.mock';
import { mockStomaTradeContractService } from '../../test/mocks/blockchain.mock';

describe('ProfitsService', () => {
  let service: ProfitsService;
  let prisma: typeof mockPrismaService;
  let contractService: typeof mockStomaTradeContractService;

  const mockUser = {
    id: 'user-uuid-1',
    walletAddress: '0xInvestorWallet',
    role: 'INVESTOR',
  };

  const mockProject = {
    id: 'project-uuid-1',
    tokenId: 3001,
    commodity: 'Rice',
    farmer: { name: 'Farmer 1' },
  };

  const mockInvestment = {
    id: 'investment-uuid-1',
    userId: 'user-uuid-1',
    projectId: 'project-uuid-1',
    amount: '100000000000000000000',
    receiptTokenId: 4001,
    profitClaims: [],
  };

  const mockProfitPool = {
    id: 'pool-uuid-1',
    projectId: 'project-uuid-1',
    totalDeposited: '100000000000000000000',
    totalClaimed: '0',
    remainingProfit: '100000000000000000000',
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
  };

  const mockProfitClaim = {
    id: 'claim-uuid-1',
    userId: 'user-uuid-1',
    profitPoolId: 'pool-uuid-1',
    investmentId: 'investment-uuid-1',
    amount: '10000000000000000000',
    transactionHash: '0xClaimTxHash',
    claimedAt: new Date(),
    deleted: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfitsService,
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

    service = module.get<ProfitsService>(ProfitsService);
    prisma = mockPrismaService;
    contractService = mockStomaTradeContractService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('depositProfit', () => {
    it('should deposit profit to pool', async () => {
      const depositDto = {
        projectId: 'project-uuid-1',
        amount: '100000000000000000000',
      };

      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.profitPool.findUnique.mockResolvedValue(null);
      prisma.profitPool.create.mockResolvedValue(mockProfitPool);
      
      contractService.withdrawProject.mockResolvedValue({
        hash: '0xDepositTxHash',
        receipt: { status: 1 },
        success: true,
        blockNumber: 12345678,
      });

      const result = await service.depositProfit(depositDto);

      expect(contractService.withdrawProject).toHaveBeenCalled();
      expect(result).toHaveProperty('profitPool');
      expect(result).toHaveProperty('transaction');
    });

    it('should update existing profit pool', async () => {
      const depositDto = {
        projectId: 'project-uuid-1',
        amount: '50000000000000000000',
      };

      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.profitPool.findUnique.mockResolvedValue(mockProfitPool);
      prisma.profitPool.update.mockResolvedValue({
        ...mockProfitPool,
        totalDeposited: '150000000000000000000',
        remainingProfit: '150000000000000000000',
      });
      
      contractService.withdrawProject.mockResolvedValue({
        hash: '0xDepositTxHash',
        receipt: { status: 1 },
        success: true,
        blockNumber: 12345678,
      });

      const result = await service.depositProfit(depositDto);

      expect(prisma.profitPool.update).toHaveBeenCalled();
      expect(result.profitPool.totalDeposited).toBe('150000000000000000000');
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.depositProfit({
          projectId: 'non-existent',
          amount: '100',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if project has no tokenId', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...mockProject, tokenId: null });

      await expect(
        service.depositProfit({
          projectId: 'project-uuid-1',
          amount: '100',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimProfit', () => {
    it('should claim profit for user', async () => {
      const claimDto = {
        userId: 'user-uuid-1',
        projectId: 'project-uuid-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.investment.findFirst.mockResolvedValue(mockInvestment);
      prisma.profitPool.findUnique.mockResolvedValue(mockProfitPool);
      prisma.profitPool.update.mockResolvedValue({
        ...mockProfitPool,
        totalClaimed: '10000000000000000000',
        remainingProfit: '90000000000000000000',
      });
      prisma.profitClaim.create.mockResolvedValue(mockProfitClaim);
      
      contractService.claimWithdraw.mockResolvedValue({
        hash: '0xClaimTxHash',
        receipt: { status: 1, logs: [] },
        success: true,
        blockNumber: 12345678,
      });
      contractService.getContract.mockReturnValue({
        interface: {
          parseLog: jest.fn().mockReturnValue({
            name: 'ProfitClaimed',
            args: { amount: BigInt(10000000000000000000) },
          }),
        },
      });
      contractService.getEventFromReceipt.mockReturnValue({
        topics: ['0xtopic1'],
        data: '0xdata',
      });

      const result = await service.claimProfit(claimDto);

      expect(contractService.claimWithdraw).toHaveBeenCalled();
      expect(result).toEqual(mockProfitClaim);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.claimProfit({
          userId: 'non-existent',
          projectId: 'project-uuid-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no investment found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.investment.findFirst.mockResolvedValue(null);

      await expect(
        service.claimProfit({
          userId: 'user-uuid-1',
          projectId: 'project-uuid-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getProjectProfitPool', () => {
    it('should return profit pool for project', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.profitPool.findUnique.mockResolvedValue(mockProfitPool);

      const result = await service.getProjectProfitPool('project-uuid-1');

      expect(result).toEqual(mockProfitPool);
    });

    it('should return empty pool if not exists', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.profitPool.findUnique.mockResolvedValue(null);

      const result = await service.getProjectProfitPool('project-uuid-1');

      expect(result.totalDeposited).toBe('0');
      expect(result.totalClaimed).toBe('0');
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectProfitPool('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserProfitClaims', () => {
    it('should return user profit claims', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.profitClaim.findMany.mockResolvedValue([mockProfitClaim]);

      const result = await service.getUserProfitClaims('user-uuid-1');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserProfitClaims('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllProfitPools', () => {
    it('should return all profit pools', async () => {
      prisma.profitPool.findMany.mockResolvedValue([mockProfitPool]);

      const result = await service.getAllProfitPools();

      expect(result).toHaveLength(1);
    });
  });
});

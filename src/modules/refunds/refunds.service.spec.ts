import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { mockPrismaService } from '../../test/mocks/prisma.mock';
import { mockStomaTradeContractService } from '../../test/mocks/blockchain.mock';

describe('RefundsService', () => {
  let service: RefundsService;
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
    projectSubmission: {},
  };

  const mockInvestment = {
    id: 'investment-uuid-1',
    userId: 'user-uuid-1',
    projectId: 'project-uuid-1',
    amount: '100000000000000000000',
    receiptTokenId: 4001,
    deleted: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
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

    service = module.get<RefundsService>(RefundsService);
    prisma = mockPrismaService;
    contractService = mockStomaTradeContractService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('markRefundable', () => {
    it('should mark project as refundable', async () => {
      const dto = {
        projectId: 'project-uuid-1',
        reason: 'Crowdfunding failed',
      };

      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.blockchainTransaction.create.mockResolvedValue({
        id: 'tx-uuid-1',
        transactionHash: '0xTxHash',
      });

      contractService.refundProject.mockResolvedValue({
        hash: '0xTxHash',
        receipt: { status: 1 },
        success: true,
        blockNumber: 12345678,
      });
      contractService.getContract.mockReturnValue({
        runner: { address: '0xPlatformAddress' },
      });
      contractService.getContractAddress.mockReturnValue('0xContractAddress');
      contractService.getSignerAddress.mockReturnValue('0xPlatformAddress');

      const result = await service.markRefundable(dto);

      expect(contractService.refundProject).toHaveBeenCalled();
      expect(result.status).toBe('REFUNDABLE');
      expect(result.reason).toBe('Crowdfunding failed');
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.markRefundable({
          projectId: 'non-existent',
          reason: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if project has no tokenId', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...mockProject, tokenId: null });

      await expect(
        service.markRefundable({
          projectId: 'project-uuid-1',
          reason: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimRefund', () => {
    it('should claim refund for user', async () => {
      const dto = {
        userId: 'user-uuid-1',
        projectId: 'project-uuid-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.investment.findFirst.mockResolvedValue(mockInvestment);
      prisma.blockchainTransaction.create.mockResolvedValue({
        id: 'tx-uuid-1',
        transactionHash: '0xRefundTxHash',
      });
      prisma.investment.update.mockResolvedValue({ ...mockInvestment, deleted: true });
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.investmentPortfolio.upsert.mockResolvedValue({});

      contractService.claimRefund.mockResolvedValue({
        hash: '0xRefundTxHash',
        receipt: { status: 1, logs: [] },
        success: true,
        blockNumber: 12345678,
      });
      contractService.getContract.mockReturnValue({
        runner: { address: '0xPlatformAddress' },
        interface: {
          parseLog: jest.fn().mockReturnValue({
            name: 'Refunded',
            args: { amount: BigInt(100000000000000000000) },
          }),
        },
      });
      contractService.getEventFromReceipt.mockReturnValue({
        topics: ['0xtopic1'],
        data: '0xdata',
      });
      contractService.getSignerAddress.mockReturnValue('0xPlatformAddress');

      const result = await service.claimRefund(dto);

      expect(contractService.claimRefund).toHaveBeenCalled();
      expect(result).toHaveProperty('investmentId');
      expect(result).toHaveProperty('refundedAmount');
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.claimRefund({
          userId: 'non-existent',
          projectId: 'project-uuid-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.claimRefund({
          userId: 'user-uuid-1',
          projectId: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no investment found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.investment.findFirst.mockResolvedValue(null);

      await expect(
        service.claimRefund({
          userId: 'user-uuid-1',
          projectId: 'project-uuid-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRefundableProjects', () => {
    it('should return refundable projects', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject]);

      const result = await service.getRefundableProjects();

      expect(result).toHaveLength(1);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          tokenId: { not: null },
          deleted: false,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('getUserRefundClaims', () => {
    it('should return user refund claims', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.investment.findMany.mockResolvedValue([
        { ...mockInvestment, deleted: true },
      ]);

      const result = await service.getUserRefundClaims('user-uuid-1');

      expect(result).toHaveLength(1);
      expect(prisma.investment.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-uuid-1',
          deleted: true,
        },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserRefundClaims('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PortfoliosService } from './portfolios.service';
import { PrismaService } from '../../prisma/prisma.service';
import { mockPrismaService } from '../../test/mocks/prisma.mock';

describe('PortfoliosService', () => {
  let service: PortfoliosService;
  let prisma: typeof mockPrismaService;

  const mockPortfolio = {
    id: 'portfolio-uuid-1',
    userId: 'user-uuid-1',
    totalInvested: '500000000000000000000',
    totalProfit: '50000000000000000000',
    totalClaimed: '25000000000000000000',
    activeInvestments: 5,
    completedInvestments: 2,
    avgROI: 10.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
  };

  const mockUser = {
    id: 'user-uuid-1',
    walletAddress: '0xInvestorWallet',
    role: 'INVESTOR',
  };

  const mockInvestments = [
    {
      id: 'investment-1',
      userId: 'user-uuid-1',
      projectId: 'project-1',
      amount: '100000000000000000000',
      receiptTokenId: 4001,
      investedAt: new Date(),
      project: {
        commodity: 'Rice',
        totalKilos: 1000,
        volume: 500000,
        farmer: { name: 'Farmer 1' },
        land: { address: 'Land 1' },
        collector: { name: 'Collector 1' },
      },
      profitClaims: [{ amount: '10000000000000000000' }],
    },
    {
      id: 'investment-2',
      userId: 'user-uuid-1',
      projectId: 'project-2',
      amount: '200000000000000000000',
      receiptTokenId: 4002,
      investedAt: new Date(),
      project: {
        commodity: 'Coffee',
        totalKilos: 2000,
        volume: 800000,
        farmer: { name: 'Farmer 2' },
        land: { address: 'Land 2' },
        collector: { name: 'Collector 2' },
      },
      profitClaims: [],
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfoliosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PortfoliosService>(PortfoliosService);
    prisma = mockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPortfolio', () => {
    it('should return portfolio for user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.investmentPortfolio.findUnique.mockResolvedValue(mockPortfolio);
      prisma.investment.findMany.mockResolvedValue(mockInvestments);
      prisma.file.findMany.mockResolvedValue([
        { reffId: 'project-1', url: 'https://example.com/image1.jpg' },
        { reffId: 'project-2', url: 'https://example.com/image2.jpg' },
      ]);

      const result = await service.getUserPortfolio('user-uuid-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(result).toHaveProperty('investments');
      expect(result.investments).toHaveLength(2);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserPortfolio('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create portfolio if not exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.investmentPortfolio.findUnique.mockResolvedValue(null);
      prisma.investmentPortfolio.create.mockResolvedValue({
        ...mockPortfolio,
        totalInvested: '0',
        totalProfit: '0',
        totalClaimed: '0',
        activeInvestments: 0,
      });
      prisma.investment.findMany.mockResolvedValue([]);
      prisma.file.findMany.mockResolvedValue([]);

      const result = await service.getUserPortfolio('user-uuid-1');

      expect(prisma.investmentPortfolio.create).toHaveBeenCalled();
      expect(result.investments).toHaveLength(0);
    });
  });

  describe('getAllPortfolios', () => {
    it('should return all portfolios', async () => {
      prisma.investmentPortfolio.findMany.mockResolvedValue([mockPortfolio]);

      const result = await service.getAllPortfolios();

      expect(prisma.investmentPortfolio.findMany).toHaveBeenCalledWith({
        where: { deleted: false },
        include: {
          user: {
            select: {
              id: true,
              walletAddress: true,
              role: true,
            },
          },
        },
        orderBy: {
          totalInvested: 'desc',
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getTopInvestors', () => {
    it('should return top investors', async () => {
      prisma.investmentPortfolio.findMany.mockResolvedValue([mockPortfolio]);

      const result = await service.getTopInvestors(10);

      expect(prisma.investmentPortfolio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should use default limit of 10', async () => {
      prisma.investmentPortfolio.findMany.mockResolvedValue([mockPortfolio]);

      await service.getTopInvestors();

      expect(prisma.investmentPortfolio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });
  });

  describe('getGlobalStats', () => {
    it('should return global statistics', async () => {
      prisma.investmentPortfolio.findMany.mockResolvedValue([
        mockPortfolio,
        {
          ...mockPortfolio,
          id: 'portfolio-2',
          userId: 'user-2',
          totalInvested: '300000000000000000000',
          totalProfit: '30000000000000000000',
          avgROI: 8.0,
        },
      ]);

      const result = await service.getGlobalStats();

      expect(result).toHaveProperty('totalInvestors', 2);
      expect(result).toHaveProperty('totalInvested');
      expect(result).toHaveProperty('totalProfit');
      expect(result).toHaveProperty('avgROI');
    });

    it('should handle empty portfolios', async () => {
      prisma.investmentPortfolio.findMany.mockResolvedValue([]);

      const result = await service.getGlobalStats();

      expect(result.totalInvestors).toBe(0);
      expect(result.avgROI).toBe(0);
    });
  });
});

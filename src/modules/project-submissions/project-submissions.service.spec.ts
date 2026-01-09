import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectSubmissionsService } from './project-submissions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StomaTradeContractService } from '../../blockchain/services/stomatrade-contract.service';
import { mockPrismaService } from '../../test/mocks/prisma.mock';
import { mockStomaTradeContractService } from '../../test/mocks/blockchain.mock';
import { SUBMISSION_STATUS } from '@prisma/client';

describe('ProjectSubmissionsService', () => {
  let service: ProjectSubmissionsService;
  let prisma: typeof mockPrismaService;
  let contractService: typeof mockStomaTradeContractService;

  const mockProject = {
    id: 'project-uuid-1',
    commodity: 'Rice',
    farmer: {
      collector: {
        user: {
          walletAddress: '0xCollectorWallet',
        },
      },
    },
  };

  const mockSubmission = {
    id: 'submission-uuid-1',
    projectId: 'project-uuid-1',
    valueProject: '1000', // Amount bersih (akan diconvert ke wei saat blockchain)
    maxCrowdFunding: '500', // Amount bersih (akan diconvert ke wei saat blockchain)
    metadataCid: 'QmTestCid',
    status: SUBMISSION_STATUS.SUBMITTED,
    submittedBy: '0xSubmitterAddress',
    approvedBy: null,
    rejectionReason: null,
    blockchainTxId: null,
    mintedTokenId: null,
    encodedCalldata: '0xencodeddata',
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
    project: mockProject,
    transaction: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectSubmissionsService,
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

    service = module.get<ProjectSubmissionsService>(ProjectSubmissionsService);
    prisma = mockPrismaService;
    contractService = mockStomaTradeContractService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a project submission', async () => {
      const createDto = {
        projectId: 'project-uuid-1',
        valueProject: '1000', // Amount bersih
        maxCrowdFunding: '500', // Amount bersih
        metadataCid: 'QmTestCid',
        submittedBy: '0xSubmitterAddress',
      };

      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.projectSubmission.findUnique.mockResolvedValue(null);
      prisma.projectSubmission.create.mockResolvedValue(mockSubmission);

      const result = await service.create(createDto);

      expect(prisma.projectSubmission.create).toHaveBeenCalled();
      expect(result).toEqual(mockSubmission);
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          projectId: 'non-existent',
          valueProject: '100',
          maxCrowdFunding: '50',
          submittedBy: '0x123',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all submissions', async () => {
      prisma.projectSubmission.findMany.mockResolvedValue([mockSubmission]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      prisma.projectSubmission.findMany.mockResolvedValue([mockSubmission]);

      await service.findAll(SUBMISSION_STATUS.SUBMITTED);

      expect(prisma.projectSubmission.findMany).toHaveBeenCalledWith({
        where: { status: SUBMISSION_STATUS.SUBMITTED, deleted: false },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a submission by id', async () => {
      prisma.projectSubmission.findUnique.mockResolvedValue(mockSubmission);

      const result = await service.findOne('submission-uuid-1');

      expect(result).toEqual(mockSubmission);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.projectSubmission.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    it('should approve and create project on blockchain', async () => {
      const approvedSubmission = {
        ...mockSubmission,
        status: SUBMISSION_STATUS.APPROVED,
        approvedBy: '0xAdminWallet',
      };
      const mintedSubmission = {
        ...approvedSubmission,
        status: SUBMISSION_STATUS.MINTED,
        mintedTokenId: 3001,
        blockchainTxId: 'tx-uuid-1',
      };

      prisma.projectSubmission.findUnique.mockResolvedValue(mockSubmission);
      prisma.projectSubmission.update
        .mockResolvedValueOnce(approvedSubmission)
        .mockResolvedValueOnce(mintedSubmission);
      prisma.blockchainTransaction.create.mockResolvedValue({
        id: 'tx-uuid-1',
        transactionHash: '0xTxHash',
      });
      prisma.project.update.mockResolvedValue({
        ...mockProject,
        tokenId: 3001,
      });
      prisma.file.findMany.mockResolvedValue([]);
      prisma.appProject.findFirst.mockResolvedValue({
        id: 'app-project-1',
        name: 'StomaTrade',
        chainId: 'eip155:4202',
        contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        explorerUrl: 'https://sepolia-blockscout.lisk.com',
        deleted: false,
      });

      contractService.createProject.mockResolvedValue({
        hash: '0xTxHash',
        receipt: { status: 1, logs: [] },
        success: true,
        blockNumber: 12345678,
      });
      contractService.getContract.mockReturnValue({
        runner: { address: '0xPlatformAddress' },
        interface: {
          parseLog: jest.fn().mockReturnValue({
            name: 'ProjectCreated',
            args: { projectId: BigInt(3001) },
          }),
        },
      });
      contractService.getEventFromReceipt.mockReturnValue({
        topics: ['0xtopic1'],
        data: '0xdata',
      });
      contractService.getSignerAddress.mockReturnValue('0xPlatformAddress');

      const result = await service.approve('submission-uuid-1', {
        approvedBy: '0xAdminWallet',
      });

      expect(contractService.createProject).toHaveBeenCalled();
      expect(result.status).toBe(SUBMISSION_STATUS.MINTED);
    });

    it('should throw BadRequestException if AppProject not found', async () => {
      const approvedSubmission = {
        ...mockSubmission,
        status: SUBMISSION_STATUS.APPROVED,
        approvedBy: '0xAdminWallet',
      };

      prisma.projectSubmission.findUnique.mockResolvedValue(mockSubmission);
      prisma.projectSubmission.update.mockResolvedValueOnce(approvedSubmission);
      prisma.blockchainTransaction.create.mockResolvedValue({
        id: 'tx-uuid-1',
        transactionHash: '0xTxHash',
      });
      prisma.file.findMany.mockResolvedValue([]);
      prisma.appProject.findFirst.mockResolvedValue(null); // AppProject not found

      contractService.createProject.mockResolvedValue({
        hash: '0xTxHash',
        receipt: { status: 1, logs: [] },
        success: true,
        blockNumber: 12345678,
      });
      contractService.getContract.mockReturnValue({
        runner: { address: '0xPlatformAddress' },
        interface: {
          parseLog: jest.fn().mockReturnValue({
            name: 'ProjectCreated',
            args: { projectId: BigInt(3001) },
          }),
        },
      });
      contractService.getEventFromReceipt.mockReturnValue({
        topics: ['0xtopic1'],
        data: '0xdata',
      });
      contractService.getSignerAddress.mockReturnValue('0xPlatformAddress');

      await expect(
        service.approve('submission-uuid-1', { approvedBy: '0xAdmin' }),
      ).rejects.toThrow('AppProject configuration not found');
    });

    it('should throw BadRequestException if AppProject has incomplete data', async () => {
      const approvedSubmission = {
        ...mockSubmission,
        status: SUBMISSION_STATUS.APPROVED,
        approvedBy: '0xAdminWallet',
      };

      prisma.projectSubmission.findUnique.mockResolvedValue(mockSubmission);
      prisma.projectSubmission.update.mockResolvedValueOnce(approvedSubmission);
      prisma.blockchainTransaction.create.mockResolvedValue({
        id: 'tx-uuid-1',
        transactionHash: '0xTxHash',
      });
      prisma.file.findMany.mockResolvedValue([]);
      prisma.appProject.findFirst.mockResolvedValue({
        id: 'app-project-1',
        name: 'StomaTrade',
        chainId: null, // Missing chainId
        contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        explorerUrl: 'https://sepolia-blockscout.lisk.com',
        deleted: false,
      });

      contractService.createProject.mockResolvedValue({
        hash: '0xTxHash',
        receipt: { status: 1, logs: [] },
        success: true,
        blockNumber: 12345678,
      });
      contractService.getContract.mockReturnValue({
        runner: { address: '0xPlatformAddress' },
        interface: {
          parseLog: jest.fn().mockReturnValue({
            name: 'ProjectCreated',
            args: { projectId: BigInt(3001) },
          }),
        },
      });
      contractService.getEventFromReceipt.mockReturnValue({
        topics: ['0xtopic1'],
        data: '0xdata',
      });
      contractService.getSignerAddress.mockReturnValue('0xPlatformAddress');

      await expect(
        service.approve('submission-uuid-1', { approvedBy: '0xAdmin' }),
      ).rejects.toThrow('AppProject has incomplete blockchain configuration');
    });

    it('should throw BadRequestException if already processed', async () => {
      const approvedSubmission = {
        ...mockSubmission,
        status: SUBMISSION_STATUS.APPROVED,
      };
      prisma.projectSubmission.findUnique.mockResolvedValue(approvedSubmission);

      await expect(
        service.approve('submission-uuid-1', { approvedBy: '0xAdmin' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('should reject a submission', async () => {
      const rejectedSubmission = {
        ...mockSubmission,
        status: SUBMISSION_STATUS.REJECTED,
        approvedBy: '0xAdminWallet',
        rejectionReason: 'Project not viable',
      };

      prisma.projectSubmission.findUnique.mockResolvedValue(mockSubmission);
      prisma.projectSubmission.update.mockResolvedValue(rejectedSubmission);

      const result = await service.reject('submission-uuid-1', {
        rejectedBy: '0xAdminWallet',
        rejectionReason: 'Project not viable',
      });

      expect(result.status).toBe(SUBMISSION_STATUS.REJECTED);
    });
  });
});

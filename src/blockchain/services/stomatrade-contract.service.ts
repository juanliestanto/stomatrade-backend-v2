import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EthersProviderService } from './ethers-provider.service';
import { PlatformWalletService } from './platform-wallet.service';
import { TransactionService, TransactionResult } from './transaction.service';
import { PrismaService } from 'src/prisma/prisma.service';

// Based on smart contract `projects` mapping
export interface ProjectData {
  id: bigint;
  idToken: bigint;
  valueProject: bigint;
  maxInvested: bigint;
  totalRaised: bigint;
  totalKilos: bigint;
  profitPerKillos: bigint;
  sharedProfit: bigint;
  status: number; // ProjectStatus enum
}

// Based on smart contract `contribution` mapping
export interface ContributionData {
  id: bigint;
  idToken: bigint;
  idProject: bigint;
  investor: string;
  amount: bigint;
  status: number; // InvestmentStatus enum
}

// Return type for getAdminRequiredDeposit
export interface AdminRequiredDeposit {
  totalPrincipal: bigint;
  totalInvestorProfit: bigint;
  totalRequired: bigint;
}

// Return type for getInvestorReturn
export interface InvestorReturn {
  principal: bigint;
  profit: bigint;
  totalReturn: bigint;
}

// Return type for getProjectProfitBreakdown
export interface ProjectProfitBreakdown {
  grossProfit: bigint;
  investorProfitPool: bigint;
  platformProfit: bigint;
}

@Injectable()
export class StomaTradeContractService implements OnModuleInit {
  private readonly logger = new Logger(StomaTradeContractService.name);
  private contract: ethers.Contract;
  private stomatradeAddress: string;
  private stomatradeAbi: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly providerService: EthersProviderService,
    private readonly walletService: PlatformWalletService,
    private readonly transactionService: TransactionService,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    const project = await this.prisma.appProject.findFirst({
      where: {
        name: 'StomaTrade',
      },
    });


    if (!project?.contractAddress) {
      throw new Error('STOMA_TRADE_ADDRESS not found');
    }
    this.stomatradeAddress = project.contractAddress;

    if (!project?.abi) {
      throw new Error('STOMA_TRADE_ABI not found');
    }
    this.stomatradeAbi = JSON.parse(project.abi.replace(/\\"/g, '"'));

    // Wait for wallet service to initialize first
    await this.walletService.waitForInit();

    const wallet = this.walletService.getWallet();
    this.contract = new ethers.Contract(
      this.stomatradeAddress,
      this.stomatradeAbi,
      wallet,
    );

    this.logger.log(
      `StomaTrade contract initialized at: ${this.stomatradeAddress}`,
    );
  }

  getContract(): ethers.Contract {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    return this.contract;
  }

  getstomatradeAddress(): string {
    return this.stomatradeAddress;
  }

  /**
   * Encode raw calldata for a contract function using the loaded ABI.
   * Useful for frontends that need hex data without sending a transaction.
   */
  encodeFunctionData(functionName: string, args: unknown[]): string {
    const contract = this.getContract();
    return contract.interface.encodeFunctionData(functionName, args);
  }

  /**
   * Extract CID from various IPFS URL formats
   */
  private extractCID(url: string): string {
    if (!url) return '';

    // ipfs://QmXxx... → QmXxx...
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', '');
    }

    // https://ipfs.io/ipfs/QmXxx... → QmXxx...
    // https://gateway.pinata.cloud/ipfs/QmXxx... → QmXxx...
    const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (match) {
      return match[1];
    }

    // If already a CID or unknown format, return as is
    return url;
  }

  getCreateProjectCalldata(
    cid: string,
    valueProject: string | bigint,
    maxInvested: string | bigint,
    totalKilos: string | bigint,
    profitPerKillos: string | bigint,
    sharedProfit: number | bigint,
  ): string {
    return this.encodeFunctionData('createProject', [
      cid,
      valueProject,
      maxInvested,
      totalKilos,
      profitPerKillos,
      sharedProfit,
    ]);
  }

  getMintFarmerCalldata(
    cid: string,
    idCollector: string,
    name: string,
    age: number | bigint,
    domicile: string,
  ): string {
    return this.encodeFunctionData('addFarmer', [
      cid,
      idCollector,
      name,
      age,
      domicile,
    ]);
  }

  /**
   * Get the signer address
   */
  async getSignerAddress(): Promise<string> {
    const runner = this.contract.runner;
    if (runner && 'getAddress' in runner) {
      return await (runner as ethers.Signer).getAddress();
    }
    return '';
  }

  // ============ WRITE FUNCTIONS ============

  /**
   * Create a new project on the blockchain
   */
  async createProject(
    cid: string,
    valueProject: bigint,
    maxInvested: bigint,
    totalKilos: bigint,
    profitPerKillos: bigint,
    sharedProfit: bigint,
  ): Promise<TransactionResult> {
    this.logger.log('Creating project on blockchain');

    return await this.transactionService.executeContractMethod(
      this.contract,
      'createProject',
      [cid, valueProject, maxInvested, totalKilos, profitPerKillos, sharedProfit],
    );
  }

  /**
   * Add Farmer NFT (called by platform after approval)
   */
  async addFarmer(
    cid: string,
    idCollector: string,
    name: string,
    age: bigint,
    domicile: string,
  ): Promise<TransactionResult> {
    this.logger.log(`Adding Farmer NFT: ${name}`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'addFarmer',
      [cid, idCollector, name, age, domicile],
    );
  }

  /**
   * Investor invests in a project
   * Note: This should be called by the investor's wallet, not the platform wallet
   */
  async invest(
    cid: string,
    projectId: bigint,
    amount: bigint,
  ): Promise<TransactionResult> {
    this.logger.log(`Investing ${amount} in project ${projectId}`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'invest',
      [cid, projectId, amount],
    );
  }

  /**
   * UPDATED: Project owner withdraws crowdfunding proceeds
   * This was previously called "depositProfit" but actual contract function is "withdrawProject"
   * The owner calls this after project is finished to withdraw the raised funds
   */
  async withdrawProject(projectId: bigint): Promise<TransactionResult> {
    this.logger.log(`Withdrawing project ${projectId} funds`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'withdrawProject',
      [projectId],
    );
  }

  /**
   * UPDATED: Investor claims profit/returns from a project
   * Contract function is "claimWithdraw", not "claimProfit"
   * Note: This should be called by the investor's wallet, not the platform wallet
   */
  async claimWithdraw(projectId: bigint): Promise<TransactionResult> {
    this.logger.log(`Claiming withdraw for project ${projectId}`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'claimWithdraw',
      [projectId],
    );
  }

  /**
   * UPDATED: Admin marks project as refundable
   * Contract function is "refundProject", not "refundable"
   */
  async refundProject(projectId: bigint): Promise<TransactionResult> {
    this.logger.log(`Marking project ${projectId} for refund`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'refundProject',
      [projectId],
    );
  }

  /**
   * Investor claims refund from a project
   * Note: This should be called by the investor's wallet, not the platform wallet
   */
  async claimRefund(projectId: bigint): Promise<TransactionResult> {
    this.logger.log(`Claiming refund for project ${projectId}`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'claimRefund',
      [projectId],
    );
  }

  /**
   * UPDATED: Close/finish project
   * Contract function is "closeProject", not "closeCrowdFunding"
   */
  async closeProject(projectId: bigint): Promise<TransactionResult> {
    this.logger.log(`Closing project ${projectId}`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'closeProject',
      [projectId],
    );
  }

  /**
   * NEW: Finish project (marks project as completed)
   * This is a separate action from closing crowdfunding
   */
  async finishProject(projectId: bigint): Promise<TransactionResult> {
    this.logger.log(`Finishing project ${projectId}`);

    return await this.transactionService.executeContractMethod(
      this.contract,
      'finishProject',
      [projectId],
    );
  }

  // ============ READ FUNCTIONS ============

  /**
   * UPDATED: Get project data using projects mapping
   * Contract uses mapping, not a getter function
   */
  async getProject(projectId: bigint): Promise<ProjectData> {
    this.logger.log(`Getting project ${projectId} data`);

    const result = await this.transactionService.callContractMethod(
      this.contract,
      'projects',
      [projectId],
    );

    return {
      id: result.id,
      idToken: result.idToken,
      valueProject: result.valueProject,
      maxInvested: result.maxInvested,
      totalRaised: result.totalRaised,
      totalKilos: result.totalKilos,
      profitPerKillos: result.profitPerKillos,
      sharedProfit: result.sharedProfit,
      status: result.status,
    };
  }

  /**
   * UPDATED: Get investor contribution using contribution mapping
   * Contract uses mapping, not a getter function
   */
  async getContribution(
    projectId: bigint,
    investor: string,
  ): Promise<ContributionData> {
    this.logger.log(`Getting contribution for project ${projectId} from ${investor}`);

    const result = await this.transactionService.callContractMethod(
      this.contract,
      'contribution',
      [projectId, investor],
    );

    return {
      id: result.id,
      idToken: result.idToken,
      idProject: result.idProject,
      investor: result.investor,
      amount: result.amount,
      status: result.status,
    };
  }

  /**
   * NEW: Get admin required deposit for project completion
   * Returns total principal, investor profit, and total required
   */
  async getAdminRequiredDeposit(projectId: bigint): Promise<AdminRequiredDeposit> {
    this.logger.log(`Getting admin required deposit for project ${projectId}`);

    const result = await this.transactionService.callContractMethod(
      this.contract,
      'getAdminRequiredDeposit',
      [projectId],
    );

    return {
      totalPrincipal: result.totalPrincipal,
      totalInvestorProfit: result.totalInvestorProfit,
      totalRequired: result.totalRequired,
    };
  }

  /**
   * NEW: Get investor return calculation
   * Returns principal, profit, and total return for an investor
   */
  async getInvestorReturn(
    projectId: bigint,
    investor: string,
  ): Promise<InvestorReturn> {
    this.logger.log(`Getting investor return for project ${projectId} investor ${investor}`);

    const result = await this.transactionService.callContractMethod(
      this.contract,
      'getInvestorReturn',
      [projectId, investor],
    );

    return {
      principal: result.principal,
      profit: result.profit,
      totalReturn: result.totalReturn,
    };
  }

  /**
   * NEW: Get project profit breakdown
   * Returns gross profit, investor profit pool, and platform profit
   */
  async getProjectProfitBreakdown(projectId: bigint): Promise<ProjectProfitBreakdown> {
    this.logger.log(`Getting profit breakdown for project ${projectId}`);

    const result = await this.transactionService.callContractMethod(
      this.contract,
      'getProjectProfitBreakdown',
      [projectId],
    );

    return {
      grossProfit: result.grossProfit,
      investorProfitPool: result.investorProfitPool,
      platformProfit: result.platformProfit,
    };
  }

  /**
   * Get token URI for an NFT
   */
  async getTokenURI(tokenId: bigint): Promise<string> {
    this.logger.log(`Getting token URI for token ${tokenId}`);

    return await this.transactionService.callContractMethod(
      this.contract,
      'tokenURI',
      [tokenId],
    );
  }

  // ============ BACKWARD COMPATIBILITY METHODS ============
  // These methods maintain backward compatibility with existing services

  /**
   * @deprecated Use withdrawProject() instead
   * Backward compatibility: depositProfit now calls withdrawProject
   */
  async depositProfit(projectId: bigint, _amount?: bigint): Promise<TransactionResult> {
    this.logger.warn('depositProfit() is deprecated, use withdrawProject() instead');
    return this.withdrawProject(projectId);
  }

  /**
   * @deprecated Use claimWithdraw() instead
   * Backward compatibility: claimProfit now calls claimWithdraw
   */
  async claimProfit(projectId: bigint): Promise<TransactionResult> {
    this.logger.warn('claimProfit() is deprecated, use claimWithdraw() instead');
    return this.claimWithdraw(projectId);
  }

  /**
   * @deprecated Use refundProject() instead
   * Backward compatibility: markRefundable now calls refundProject
   */
  async markRefundable(projectId: bigint): Promise<TransactionResult> {
    this.logger.warn('markRefundable() is deprecated, use refundProject() instead');
    return this.refundProject(projectId);
  }

  /**
   * @deprecated Use closeProject() instead
   * Backward compatibility: closeCrowdFunding now calls closeProject
   */
  async closeCrowdFunding(projectId: bigint): Promise<TransactionResult> {
    this.logger.warn('closeCrowdFunding() is deprecated, use closeProject() instead');
    return this.closeProject(projectId);
  }

  /**
   * @deprecated Use getProject() with new ProjectData interface instead
   * Backward compatibility: Returns legacy format
   */
  async getProfitPool(_projectId: bigint): Promise<bigint> {
    this.logger.warn('getProfitPool() is deprecated and not available in contract');
    throw new Error('getProfitPool() is not available. Use getProjectProfitBreakdown() instead');
  }

  /**
   * @deprecated Use getInvestorReturn() instead
   * Backward compatibility: Returns only amount (principal)
   */
  async getClaimedProfit(_projectId: bigint, _investor: string): Promise<bigint> {
    this.logger.warn('getClaimedProfit() is deprecated and not available in contract');
    throw new Error('getClaimedProfit() is not available. Use getInvestorReturn() instead');
  }

  // ============ EVENT PARSING ============

  /**
   * Parse event logs from transaction receipt
   */
  parseEventLogs(receipt: ethers.TransactionReceipt): ethers.EventLog[] {
    const parsedLogs: ethers.EventLog[] = [];

    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed) {
          parsedLogs.push(log as ethers.EventLog);
        }
      } catch (error) {
        // Ignore logs that can't be parsed (may be from other contracts)
      }
    }

    return parsedLogs;
  }

  /**
   * Get specific event from transaction receipt
   */
  getEventFromReceipt(
    receipt: ethers.TransactionReceipt,
    eventName: string,
  ): ethers.EventLog | null {
    const parsedLogs = this.parseEventLogs(receipt);

    for (const log of parsedLogs) {
      const parsed = this.contract.interface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      if (parsed && parsed.name === eventName) {
        return log;
      }
    }

    return null;
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EthersProviderService implements OnModuleInit {
  private readonly logger = new Logger(EthersProviderService.name);
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  private initPromise: Promise<void>;
  private isInitialized = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize() {
    // Get blockchain configuration from database
    const appProject = await this.prisma.appProject.findFirst({
      where: {
        name: 'StomaTrade',
      },
    });

    if (!appProject?.rpcUrl) {
      throw new Error('RPC URL not found in database for StomaTrade project');
    }

    if (!appProject?.chainId) {
      throw new Error('Chain ID not found in database for StomaTrade project');
    }

    const rpcUrl = appProject.rpcUrl;

    // Parse chainId from CAIP-2 format (e.g., "eip155:5003" -> 5003)
    const chainIdMatch = appProject.chainId.match(/eip155:(\d+)/);
    if (!chainIdMatch) {
      throw new Error(
        `Invalid chainId format in database: ${appProject.chainId}. Expected format: eip155:<chainId>`,
      );
    }

    this.chainId = parseInt(chainIdMatch[1], 10);

    // Create custom network
    const customNetwork = new ethers.Network('mantle-sepolia', this.chainId);

    this.provider = new ethers.JsonRpcProvider(rpcUrl, customNetwork, {
      staticNetwork: customNetwork,
    });

    try {
      const network = await this.provider.getNetwork();
      this.isInitialized = true;
      this.logger.log(
        `Connected to blockchain network: ${network.name} (Chain ID: ${network.chainId})`,
      );
      this.logger.log(`RPC URL: ${rpcUrl}`);
      this.logger.log(`CAIP-2 Chain ID: ${appProject.chainId}`);
    } catch (error) {
      this.logger.error('Failed to connect to blockchain provider', error);
      throw error;
    }
  }

  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider;
  }

  getChainId(): number {
    return this.chainId;
  }

  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || BigInt(0);
  }

  async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(transaction);
  }

  async waitForTransaction(
    txHash: string,
    confirmations = 1,
    timeout = 60000,
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      const receipt = await this.provider.waitForTransaction(
        txHash,
        confirmations,
        timeout,
      );
      return receipt;
    } catch (error) {
      this.logger.error(`Error waiting for transaction ${txHash}`, error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    return await this.provider.getTransaction(txHash);
  }

  async getTransactionReceipt(
    txHash: string,
  ): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  async getBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  async getBlock(blockNumber: number): Promise<ethers.Block | null> {
    return await this.provider.getBlock(blockNumber);
  }

  parseUnits(value: string, decimals = 18): bigint {
    return ethers.parseUnits(value, decimals);
  }

  formatUnits(value: bigint, decimals = 18): string {
    return ethers.formatUnits(value, decimals);
  }

  isAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  getAddress(address: string): string {
    return ethers.getAddress(address);
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EthersProviderService } from './ethers-provider.service';

@Injectable()
export class PlatformWalletService implements OnModuleInit {
  private readonly logger = new Logger(PlatformWalletService.name);
  private wallet: ethers.Wallet;
  private walletAddress: string;
  private initPromise: Promise<void>;

  constructor(
    private readonly configService: ConfigService,
    private readonly providerService: EthersProviderService,
  ) { }

  async onModuleInit() {
    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize() {
    const privateKey = this.configService.get<string>(
      'PLATFORM_WALLET_PRIVATE_KEY',
    );

    if (!privateKey) {
      throw new Error('PLATFORM_WALLET_PRIVATE_KEY is not configured');
    }

    try {
      // Wait for provider service to initialize first
      await this.providerService.waitForInit();

      // Create wallet from private key
      const provider = this.providerService.getProvider();
      this.wallet = new ethers.Wallet(privateKey, provider);
      this.walletAddress = this.wallet.address;


      if (!this.wallet.provider){
        throw new Error ("wallet no found");
      }

      // Log wallet info (not the private key!)
      const balance = await this.wallet.provider.getBalance(this.walletAddress);
      this.logger.log(`Platform wallet initialized: ${this.walletAddress}`);
      this.logger.log(
        `Platform wallet balance: ${ethers.formatEther(balance)} ETH`,
      );

      // Warn if balance is low
      if (balance < ethers.parseEther('0.01')) {
        this.logger.warn(
          'Platform wallet balance is low. Please top up to ensure transactions can be sent.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize platform wallet', error);
      throw error;
    }
  }

  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  getWallet(): ethers.Wallet {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet;
  }

  getAddress(): string {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }
    return this.walletAddress;
  }

  async getBalance(): Promise<bigint> {
    if (!this.wallet || !this.wallet.provider) {
      throw new Error('Wallet not initialized');
    }

    return await this.wallet.provider.getBalance(this.walletAddress);
  }

  async getNonce(): Promise<number> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return await this.wallet.getNonce();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return await this.wallet.signMessage(message);
  }

  async signTransaction(
    transaction: ethers.TransactionRequest,
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return await this.wallet.signTransaction(transaction);
  }

  async sendTransaction(
    transaction: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      const tx = await this.wallet.sendTransaction(transaction);
      this.logger.log(`Transaction sent: ${tx.hash}`);
      return tx;
    } catch (error) {
      this.logger.error('Failed to send transaction', error);
      throw error;
    }
  }
}

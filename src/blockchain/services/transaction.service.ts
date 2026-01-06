import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EthersProviderService } from './ethers-provider.service';
import { PlatformWalletService } from './platform-wallet.service';

export interface TransactionOptions {
  gasLimit?: bigint;
  maxRetries?: number;
  confirmationBlocks?: number;
}

export interface TransactionResult {
  hash: string;
  receipt: ethers.TransactionReceipt | null;
  success: boolean;
  blockNumber?: number;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  private readonly defaultMaxRetries: number;
  private readonly defaultConfirmationBlocks: number;
  private readonly gasLimitMultiplier: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly providerService: EthersProviderService,
    private readonly walletService: PlatformWalletService,
  ) {
    this.defaultMaxRetries =
      this.configService.get<number>('BLOCKCHAIN_MAX_RETRIES') || 3;
    this.defaultConfirmationBlocks =
      this.configService.get<number>('BLOCKCHAIN_CONFIRMATION_BLOCKS') || 1;
    this.gasLimitMultiplier =
      this.configService.get<number>('BLOCKCHAIN_GAS_LIMIT_MULTIPLIER') || 1.2;
  }

  async sendTransaction(
    transaction: ethers.TransactionRequest,
    options: TransactionOptions = {},
  ): Promise<TransactionResult> {
    const maxRetries = options.maxRetries || this.defaultMaxRetries;
    const confirmationBlocks =
      options.confirmationBlocks || this.defaultConfirmationBlocks;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.logger.log(
          `Sending transaction (attempt ${attempt + 1}/${maxRetries})`,
        );

        // Get current gas price with EIP-1559 support
        const feeData = await this.providerService.getProvider().getFeeData();

        // Get wallet address for 'from' field
        const walletAddress = this.walletService.getAddress();

        // Prepare transaction with gas settings
        const txRequest: ethers.TransactionRequest = {
          ...transaction,
          from: walletAddress, // CRITICAL: Set from address for estimateGas
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        };

        // Estimate gas if not provided
        if (!options.gasLimit) {
          const estimatedGas =
            await this.providerService.estimateGas(txRequest);
          txRequest.gasLimit = BigInt(
            Math.ceil(Number(estimatedGas) * this.gasLimitMultiplier),
          );
        } else {
          txRequest.gasLimit = options.gasLimit;
        }

        this.logger.debug(
          `Transaction config: gasLimit=${txRequest.gasLimit}, maxFeePerGas=${txRequest.maxFeePerGas}`,
        );

        // Send transaction
        const txResponse =
          await this.walletService.sendTransaction(txRequest);

        this.logger.log(`Transaction sent: ${txResponse.hash}`);

        // Wait for confirmation
        const receipt = await this.providerService.waitForTransaction(
          txResponse.hash,
          confirmationBlocks,
        );

        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }

        const success = receipt.status === 1;

        if (!success) {
          this.logger.error(
            `Transaction failed: ${txResponse.hash}`,
            receipt,
          );
          throw new Error(`Transaction reverted: ${txResponse.hash}`);
        }

        this.logger.log(
          `Transaction confirmed: ${txResponse.hash} (Block: ${receipt.blockNumber})`,
        );

        return {
          hash: txResponse.hash,
          receipt,
          success: true,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.gasPrice,
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.error(
          `Transaction attempt ${attempt + 1} failed:`,
          error,
        );

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.logger.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Transaction failed after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  async executeContractMethod(
    contract: ethers.Contract,
    methodName: string,
    args: any[],
    options: TransactionOptions = {},
  ): Promise<TransactionResult> {
    this.logger.log(`Executing contract method: ${methodName}`);

    // Populate transaction
    const populatedTx = await contract[methodName].populateTransaction(
      ...args,
    );

    return await this.sendTransaction(populatedTx, options);
  }

  async callContractMethod(
    contract: ethers.Contract,
    methodName: string,
    args: any[],
  ): Promise<any> {
    this.logger.log(`Calling contract method (read-only): ${methodName}`);

    try {
      const result = await contract[methodName](...args);
      return result;
    } catch (error) {
      this.logger.error(`Contract call failed for ${methodName}:`, error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

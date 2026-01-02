import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
// Type-only import - actual PrivyClient is lazy-loaded to prevent serverless crash
import type { PrivyClient } from '@privy-io/server-auth';
import { PrismaService } from '../../prisma/prisma.service';
import { EthersProviderService } from '../../blockchain/services/ethers-provider.service';
import { RequestNonceDto } from './dto/request-nonce.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { RegisterUserDto } from './dto/register-user.dto';

export interface JwtPayload {
  sub: string; 
  walletAddress: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    walletAddress: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private privyClient: PrivyClient | null = null;
  private privyInitialized = false;
  private privyInitError: Error | null = null;

  private readonly SIGNATURE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly providerService: EthersProviderService,
  ) {
    // Don't initialize Privy in constructor to prevent serverless crash
    // Will lazy-load when needed
    this.logger.log('AuthService initialized - Privy will be loaded on demand');
  }

  /**
   * Lazy initialization of Privy client
   * Only loads when verifyPrivyEmbeddedWallet is called
   */
  private async initPrivyClient(): Promise<PrivyClient | null> {
    // Return cached client if already initialized
    if (this.privyInitialized) {
      return this.privyClient;
    }

    // If previous initialization failed, don't retry
    if (this.privyInitError) {
      this.logger.error('Privy initialization previously failed, rejecting request');
      this.logger.error(`Previous error: ${this.privyInitError.message}`);
      return null;
    }

    try {
      const privyAppId = this.configService.get<string>('PRIVY_APP_ID');
      const privyAppSecret = this.configService.get<string>('PRIVY_APP_SECRET');

      // Enhanced logging for debugging
      this.logger.log(`[Privy Init] APP_ID configured: ${!!privyAppId} (${privyAppId ? `${privyAppId.substring(0, 10)}...` : 'missing'})`);
      this.logger.log(`[Privy Init] APP_SECRET configured: ${!!privyAppSecret} (${privyAppSecret ? 'exists' : 'missing'})`);

      if (!privyAppId || !privyAppSecret) {
        this.logger.warn('⚠️ Privy credentials not configured - rejecting Privy wallet auth');
        this.privyInitialized = true;
        return null;
      }

      // Lazy load the PrivyClient module
      this.logger.log('[Privy Init] Attempting to import @privy-io/server-auth...');
      const { PrivyClient } = await import('@privy-io/server-auth');
      this.logger.log('[Privy Init] Import successful, creating client instance...');

      this.privyClient = new PrivyClient(privyAppId, privyAppSecret);
      this.privyInitialized = true;
      this.logger.log('✅ Privy client lazy-loaded successfully');

      return this.privyClient;
    } catch (error) {
      this.logger.error('❌ Failed to lazy-load Privy client');
      this.logger.error(`Error name: ${error?.name}`);
      this.logger.error(`Error message: ${error?.message}`);
      this.logger.error(`Error stack: ${error?.stack}`);
      this.privyInitError = error as Error;
      this.privyInitialized = true;
      return null;
    }
  }

  async requestNonce(dto: RequestNonceDto): Promise<{ nonce: string; message: string }> {
    const walletAddress = dto.walletAddress.toLowerCase();

    if (!ethers.isAddress(walletAddress)) {
      throw new BadRequestException('Invalid wallet address');
    }

    const nonce = this.generateNonce();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Delete expired nonces for this wallet
    await this.prisma.nonce.deleteMany({
      where: { walletAddress },
    });

    // Store new nonce in database
    await this.prisma.nonce.create({
      data: {
        walletAddress,
        nonce,
        expiresAt,
      },
    });

    const message = this.createSignMessage(walletAddress, nonce);

    this.logger.log(`Nonce generated for wallet: ${walletAddress}`);

    return {
      nonce,
      message,
    };
  }

  async verifySignature(dto: VerifySignatureDto): Promise<AuthResponse> {
    const walletAddress = dto.walletAddress.toLowerCase();

    if (dto.message) {
      return this.loginByWallet(dto);
    }

    // Clean up expired nonces first
    await this.prisma.nonce.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    // Get nonce from database
    const storedNonce = await this.prisma.nonce.findFirst({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    if (!storedNonce) {
      throw new UnauthorizedException('Nonce not found. Please request a new nonce.');
    }

    if (new Date() > storedNonce.expiresAt) {
      await this.prisma.nonce.delete({ where: { id: storedNonce.id } });
      throw new UnauthorizedException('Nonce expired. Please request a new nonce.');
    }

    const message = this.createSignMessage(walletAddress, storedNonce.nonce);
    const isValid = this.verifyWalletSignature(message, dto.signature, walletAddress);

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Delete used nonce
    await this.prisma.nonce.delete({ where: { id: storedNonce.id } });

    let user = await this.prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {

      user = await this.prisma.user.create({
        data: {
          walletAddress,
          role: 'INVESTOR',
        },
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        role: user.role,
      },
    };
  }

  private async verifyLoginSignature(dto: VerifySignatureDto): Promise<string> {
    let invalidReason = '';
    const walletAddress = dto.walletAddress.toLowerCase();
    const message = dto.message!;

    try {
      const match = message.match(
        /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}/
      );

      if (!match) {
        invalidReason = 'Timestamp not found in message';
      } else {
        const iso = match[0].replace(' ', 'T') + '+07:00';
        const timestamp = Date.parse(iso);

        if (isNaN(timestamp)) {
          invalidReason = 'Invalid timestamp format in message';
        } else if (Date.now() - timestamp > this.SIGNATURE_EXPIRY_MS) {
          invalidReason = 'Signature expired';
        }
      }

    } catch {
      invalidReason = 'Invalid message format';
    }

    if (invalidReason) {
      return invalidReason;
    }

    const isSmartContract = await this.isContractAddress(walletAddress);

    if (isSmartContract) {
      const isValid = await this.verifySmartWalletSignature(
        message,
        dto.signature,
        walletAddress,
      );

      if (!isValid) {
        invalidReason = 'Invalid smart wallet signature';
      }
    } else {
      try {
        const recoveredAddress = ethers.verifyMessage(message, dto.signature);

        if (walletAddress !== recoveredAddress.toLowerCase()) {
          this.logger.warn(`Address mismatch - checking if Privy embedded wallet`);

          const isPrivyWallet = await this.verifyPrivyEmbeddedWallet(
            walletAddress,
            message,
            dto.signature,
            recoveredAddress,
          );

          if (!isPrivyWallet) {
            invalidReason = 'Invalid signer';
          } 
        }
      } catch (error) {
        invalidReason = 'Signature verification failed';
      }
    }

    return invalidReason;
  }

  private async loginByWallet(dto: VerifySignatureDto): Promise<AuthResponse> {
    const walletAddress = dto.walletAddress.toLowerCase();

    const invalidReason = await this.verifyLoginSignature(dto);
    if (invalidReason) {
      throw new UnauthorizedException(invalidReason);
    }

    let user = await this.prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      
      user = await this.prisma.user.create({
        data: {
          walletAddress,
          role: 'INVESTOR',
        },
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        role: user.role,
      },
    };
  }

  private async isContractAddress(address: string): Promise<boolean> {
    try {
      const provider = this.providerService.getProvider();
      const code = await provider.getCode(address);

      return code !== '0x';
    } catch (error) {
      return false;
    }
  }

  private async verifyPrivyEmbeddedWallet(
    expectedWallet: string,
    message: string,
    signature: string,
    recoveredAddress: string,
  ): Promise<boolean> {
    try {
      // SECURITY: FAIL-CLOSED APPROACH
      // Lazy load Privy client on first use
      const client = await this.initPrivyClient();

      if (!client) {
        this.logger.error('SECURITY: Privy client not available - REJECTING authentication');
        return false; // FAIL-CLOSED: Reject if we cannot verify with Privy
      }

      this.logger.log(`Verifying Privy embedded wallet for: ${expectedWallet}`);
      this.logger.log(`  Signature created by: ${recoveredAddress.toLowerCase()}`);

      try {
        // Get user by wallet address from Privy
        const user = await client.getUserByWalletAddress(expectedWallet);

        if (!user) {
          this.logger.warn(`SECURITY: No Privy user found for wallet: ${expectedWallet}`);
          return false; // FAIL-CLOSED: Reject if wallet not registered with Privy
        }

        this.logger.log(`Privy user found: ${user.id}`);

        // Check if the wallet is an embedded wallet
        const embeddedWallet = user.linkedAccounts.find(
          (account) =>
            account.type === 'wallet' &&
            account.walletClientType === 'privy' &&
            account.address.toLowerCase() === expectedWallet.toLowerCase()
        );

        if (embeddedWallet) {
          this.logger.log(`✅ VERIFIED: Privy embedded wallet authenticated successfully`);
          return true;
        } else {
          this.logger.warn(`SECURITY: Wallet ${expectedWallet} is not a Privy embedded wallet`);
          return false; // FAIL-CLOSED: Reject if not an embedded wallet
        }
      } catch (privyError) {
        // SECURITY: FAIL-CLOSED on API failure
        this.logger.error('SECURITY: Privy API verification failed - REJECTING authentication', privyError);
        return false; // FAIL-CLOSED: Reject if Privy API is unavailable or fails
      }
    } catch (error) {
      this.logger.error('SECURITY: Error verifying Privy embedded wallet - REJECTING', error);
      return false; // FAIL-CLOSED: Reject on any unexpected error
    }
  }

  private async verifySmartWalletSignature(
    message: string,
    signature: string,
    walletAddress: string,
  ): Promise<boolean> {
    try {

      const EIP1271_MAGIC_VALUE = '0x1626ba7e';

      const provider = this.providerService.getProvider();

      const messageHash = ethers.hashMessage(message);

      const eip1271Abi = [
        'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)',
      ];

      const contract = new ethers.Contract(walletAddress, eip1271Abi, provider);

      const result = await contract.isValidSignature(messageHash, signature);

      return result === EIP1271_MAGIC_VALUE;
    } catch (error) {
      this.logger.error('Smart wallet signature verification failed', error);
      return false;
    }
  }

  async registerUser(dto: RegisterUserDto): Promise<AuthResponse> {
    const walletAddress = dto.walletAddress.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { walletAddress },
    });

    if (existingUser) {
      throw new BadRequestException('User with this wallet address already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        walletAddress,
        role: dto.role,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted: false },
      include: {
        collector: true,
        investments: {
          take: 5,
          orderBy: { investedAt: 'desc' },
        },
        portfolios: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted: false },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  private generateNonce(): string {
    return Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }

  private createSignMessage(walletAddress: string, nonce: string): string {
    return `Welcome to StoMaTrade!\n\nPlease sign this message to authenticate.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\n\nThis signature will not cost you any gas fees.`;
  }

  private verifyWalletSignature(
    message: string,
    signature: string,
    expectedAddress: string,
  ): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch (error) {
      return null;
    }
  }
}

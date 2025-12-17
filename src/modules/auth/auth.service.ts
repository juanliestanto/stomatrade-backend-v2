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
import { PrivyClient } from '@privy-io/server-auth';
import { PrismaService } from '../../prisma/prisma.service';
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
  private readonly privyClient: PrivyClient;

  private nonceStore: Map<string, { nonce: string; expiresAt: Date }> = new Map();

  private readonly SIGNATURE_EXPIRY_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const privyAppId = this.configService.get<string>('PRIVY_APP_ID');
    const privyAppSecret = this.configService.get<string>('PRIVY_APP_SECRET');

    if (privyAppId && privyAppSecret) {
      try {
        this.privyClient = new PrivyClient(privyAppId, privyAppSecret);
        this.logger.log('✅ Privy client initialized successfully');
      } catch (error) {
        this.logger.error('❌ Failed to initialize Privy client - Privy wallet auth will not work', error);
        this.logger.error('Privy embedded wallet authentication will be REJECTED (fail-closed)');
      }
    } else {
      this.logger.warn('⚠️ Privy credentials not configured');
      if (!privyAppId) this.logger.warn('  - PRIVY_APP_ID is missing');
      if (!privyAppSecret) this.logger.warn('  - PRIVY_APP_SECRET is missing');
      this.logger.warn('Privy embedded wallet authentication will be REJECTED (fail-closed)');
    }
  }

  async requestNonce(dto: RequestNonceDto): Promise<{ nonce: string; message: string }> {
    const walletAddress = dto.walletAddress.toLowerCase();
    
    if (!ethers.isAddress(walletAddress)) {
      throw new BadRequestException('Invalid wallet address');
    }

    const nonce = this.generateNonce();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    this.nonceStore.set(walletAddress, { nonce, expiresAt });

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

    const storedData = this.nonceStore.get(walletAddress);
    if (!storedData) {
      throw new UnauthorizedException('Nonce not found. Please request a new nonce.');
    }

    if (new Date() > storedData.expiresAt) {
      this.nonceStore.delete(walletAddress);
      throw new UnauthorizedException('Nonce expired. Please request a new nonce.');
    }

    const message = this.createSignMessage(walletAddress, storedData.nonce);
    const isValid = this.verifyWalletSignature(message, dto.signature, walletAddress);

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    this.nonceStore.delete(walletAddress);

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
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
      if (!rpcUrl) {
        return false;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
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
      if (!this.privyClient) {
        return false; 
      }

      try {
        const user = await this.privyClient.getUserByWalletAddress(expectedWallet);

        if (!user) {
          return false; 
        }

        const embeddedWallet = user.linkedAccounts.find(
          (account) =>
            account.type === 'wallet' &&
            account.walletClientType === 'privy' &&
            account.address.toLowerCase() === expectedWallet.toLowerCase()
        );

        if (embeddedWallet) {
          return true;
        } else {
          return false;
        }
      } catch (privyError) {
        return false; 
      }
    } catch (error) {
      return false;
    }
  }

  private async verifySmartWalletSignature(
    message: string,
    signature: string,
    walletAddress: string,
  ): Promise<boolean> {
    try {
      
      const EIP1271_MAGIC_VALUE = '0x1626ba7e';
      
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
      if (!rpcUrl) {
        return false;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
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

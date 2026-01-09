import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EthersProviderService } from './services/ethers-provider.service';
import { PlatformWalletService } from './services/platform-wallet.service';
import { StomaTradeContractService } from './services/stomatrade-contract.service';
import { BlockchainEventService } from './services/blockchain-event.service';
import { TransactionService } from './services/transaction.service';
import { HistoricalSyncService } from './services/historical-sync.service';
import { BlockchainSyncController } from './controllers/blockchain-sync.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [BlockchainSyncController],
  providers: [
    EthersProviderService,
    PlatformWalletService,
    StomaTradeContractService,
    BlockchainEventService,
    TransactionService,
    HistoricalSyncService,
  ],
  exports: [
    EthersProviderService,
    PlatformWalletService,
    StomaTradeContractService,
    BlockchainEventService,
    TransactionService,
    HistoricalSyncService,
  ],
})
export class BlockchainModule {}

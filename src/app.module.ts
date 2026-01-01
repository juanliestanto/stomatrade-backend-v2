import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { UsersModule } from './modules/users/users.module';
import { CollectorsModule } from './modules/collectors/collectors.module';
import { FarmersModule } from './modules/farmers/farmers.module';
import { LandsModule } from './modules/lands/lands.module';
import { FilesModule } from './modules/files/files.module';
import { BuyersModule } from './modules/buyers/buyers.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FarmerSubmissionsModule } from './modules/farmer-submissions/farmer-submissions.module';
import { ProjectSubmissionsModule } from './modules/project-submissions/project-submissions.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { ProfitsModule } from './modules/profits/profits.module';
import { CronModule } from './modules/cron/cron.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { UserDashboardModule } from './modules/user-dashboard/user-dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    BlockchainModule,
    AuthModule,
    UsersModule,
    CollectorsModule,
    FarmersModule,
    LandsModule,
    FilesModule,
    BuyersModule,
    ProjectsModule,
    NotificationsModule,
    FarmerSubmissionsModule,
    ProjectSubmissionsModule,
    InvestmentsModule,
    PortfoliosModule,
    ProfitsModule,
    CronModule,
    RefundsModule,
    UserDashboardModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

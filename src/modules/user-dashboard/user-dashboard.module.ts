import { Module } from '@nestjs/common';
import { UserDashboardController } from './user-dashboard.controller';
import { UserDashboardService } from './user-dashboard.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserDashboardController],
  providers: [UserDashboardService],
  exports: [UserDashboardService],
})
export class UserDashboardModule {}

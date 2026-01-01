import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PeriodType } from './dto/analytics-request.dto';
import { GrowthAnalyticsResponseDto, GrowthDataPoint } from './dto/analytics-response.dto';
import { ROLES } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  // Default limits per period type
  private readonly DEFAULT_LIMITS = {
    [PeriodType.DAILY]: 30,
    [PeriodType.WEEKLY]: 12,
    [PeriodType.MONTHLY]: 12,
    [PeriodType.YEARLY]: 999, // No limit for yearly
  };

  constructor(private readonly prisma: PrismaService) {}

  async getProjectGrowth(
    period: PeriodType,
    limit?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<GrowthAnalyticsResponseDto> {
    this.logger.log(`Fetching project growth analytics for period: ${period}`);

    const dateRange = this.calculateDateRange(period, limit, startDate, endDate);
    const appliedLimit = limit || this.DEFAULT_LIMITS[period];

    const projects = await this.prisma.project.findMany({
      where: {
        deleted: false,
        createdAt: {
          gte: new Date(dateRange.start),
          lte: new Date(dateRange.end),
        },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return this.formatGrowthData(projects, period, appliedLimit, dateRange);
  }

  async getInvestorGrowth(
    period: PeriodType,
    limit?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<GrowthAnalyticsResponseDto> {
    this.logger.log(`Fetching investor growth analytics for period: ${period}`);

    const dateRange = this.calculateDateRange(period, limit, startDate, endDate);
    const appliedLimit = limit || this.DEFAULT_LIMITS[period];

    const investors = await this.prisma.user.findMany({
      where: {
        deleted: false,
        role: ROLES.INVESTOR,
        createdAt: {
          gte: new Date(dateRange.start),
          lte: new Date(dateRange.end),
        },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return this.formatGrowthData(investors, period, appliedLimit, dateRange);
  }

  async getUserGrowth(
    period: PeriodType,
    limit?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<GrowthAnalyticsResponseDto> {
    this.logger.log(`Fetching user growth analytics for period: ${period}`);

    const dateRange = this.calculateDateRange(period, limit, startDate, endDate);
    const appliedLimit = limit || this.DEFAULT_LIMITS[period];

    const users = await this.prisma.user.findMany({
      where: {
        deleted: false,
        createdAt: {
          gte: new Date(dateRange.start),
          lte: new Date(dateRange.end),
        },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return this.formatGrowthData(users, period, appliedLimit, dateRange);
  }

  private calculateDateRange(
    period: PeriodType,
    limit?: number,
    startDate?: string,
    endDate?: string,
  ): { start: string; end: string } {
    // If custom date range provided, use it
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const appliedLimit = limit || this.DEFAULT_LIMITS[period];

    let start: Date;

    switch (period) {
      case PeriodType.DAILY:
        start = new Date(now);
        start.setDate(start.getDate() - appliedLimit + 1);
        break;

      case PeriodType.WEEKLY:
        start = new Date(now);
        start.setDate(start.getDate() - appliedLimit * 7 + 1);
        break;

      case PeriodType.MONTHLY:
        start = new Date(now);
        start.setMonth(start.getMonth() - appliedLimit + 1);
        break;

      case PeriodType.YEARLY:
        start = new Date(now);
        start.setFullYear(start.getFullYear() - appliedLimit + 1);
        break;

      default:
        start = new Date(now);
        start.setDate(start.getDate() - 30);
    }

    return {
      start: start.toISOString().split('T')[0],
      end,
    };
  }

  private formatGrowthData(
    items: { createdAt: Date }[],
    period: PeriodType,
    appliedLimit: number,
    dateRange: { start: string; end: string },
  ): GrowthAnalyticsResponseDto {
    const groupedData = new Map<string, { value: number; sortKey: string }>();

    items.forEach((item) => {
      const { label, sortKey } = this.getGroupKey(item.createdAt, period);
      const existing = groupedData.get(label);
      groupedData.set(label, {
        value: (existing?.value || 0) + 1,
        sortKey,
      });
    });

    const data: GrowthDataPoint[] = Array.from(groupedData.entries())
      .map(([label, { value, sortKey }]) => ({ label, value, sortKey }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ label, value }) => ({ label, value }));

    return {
      period,
      total: items.length,
      dataPoints: data.length,
      appliedLimit,
      dateRange,
      data,
    };
  }

  private getGroupKey(date: Date, period: PeriodType): { label: string; sortKey: string } {
    const d = new Date(date);

    switch (period) {
      case PeriodType.DAILY:
        const dailyLabel = d.toISOString().split('T')[0];
        return { label: dailyLabel, sortKey: dailyLabel };

      case PeriodType.WEEKLY:
        return this.getWeekLabel(d);

      case PeriodType.MONTHLY:
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${months[d.getMonth()]} ${d.getFullYear()}`;
        const monthSortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { label: monthLabel, sortKey: monthSortKey };

      case PeriodType.YEARLY:
        const yearLabel = d.getFullYear().toString();
        return { label: yearLabel, sortKey: yearLabel };

      default:
        const defaultLabel = d.toISOString().split('T')[0];
        return { label: defaultLabel, sortKey: defaultLabel };
    }
  }

  private getWeekLabel(date: Date): { label: string; sortKey: string } {
    // Get the start of the ISO week (Monday)
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));

    // Get the end of the week (Sunday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const startMonth = months[monday.getMonth()];
    const startDay = monday.getDate();
    const endMonth = months[sunday.getMonth()];
    const endDay = sunday.getDate();
    const year = sunday.getFullYear();

    let label: string;
    if (monday.getMonth() === sunday.getMonth()) {
      // Same month: "Jan 1-7, 2026"
      label = `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
      // Different months: "Dec 30-Jan 5, 2026"
      label = `${startMonth} ${startDay}-${endMonth} ${endDay}, ${year}`;
    }

    // Sort key for chronological ordering
    const sortKey = monday.toISOString().split('T')[0];

    return { label, sortKey };
  }
}

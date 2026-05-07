import { LogLevel } from '@prisma/client';
import prisma from '../lib/prisma';
import alertService from './alertService';
import logService from './logService';

interface LogLevelBreakdown {
  level: LogLevel;
  count: number;
  percentage: number;
}

interface ServiceRanking {
  serviceId: string;
  serviceName: string;
  totalLogs: number;
  errorCount: number;
}

interface ErrorRateTrend {
  timestamp: string;
  errorRate: number;
  totalLogs: number;
  errorLogs: number;
}

export class DashboardService {
  async getLogLevelBreakdown(hours: number = 1): Promise<LogLevelBreakdown[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const results = await prisma.log.groupBy({
      by: ['level'],
      where: {
        timestamp: { gte: startTime }
      },
      _count: {
        _all: true
      }
    });

    const totalLogs = results.reduce((sum, r) => sum + r._count._all, 0);

    return results.map(r => ({
      level: r.level,
      count: r._count._all,
      percentage: totalLogs > 0 ? (r._count._all / totalLogs) * 100 : 0
    }));
  }

  async getServiceRanking(hours: number = 24, limit: number = 10): Promise<ServiceRanking[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const endTime = new Date();

    const stats = await logService.getServiceStats(startTime.toISOString(), endTime.toISOString());

    return stats
      .sort((a, b) => b.totalLogs - a.totalLogs)
      .slice(0, limit)
      .map(s => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        totalLogs: s.totalLogs,
        errorCount: s.errorCount
      }));
  }

  async getErrorRateTrend(hours: number = 24, granularity: string = '1h'): Promise<ErrorRateTrend[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const endTime = new Date();

    let dateTrunc: string;
    switch (granularity) {
      case '1min':
        dateTrunc = 'minute';
        break;
      case '5min':
        dateTrunc = 'five_minutes';
        break;
      case '1h':
        dateTrunc = 'hour';
        break;
      case '1d':
        dateTrunc = 'day';
        break;
      default:
        dateTrunc = 'hour';
    }

    const query = `
      SELECT 
        date_trunc('${dateTrunc}', "timestamp") as "timeBucket",
        COUNT(*) as "totalLogs",
        COUNT(CASE WHEN "level" = 'ERROR' THEN 1 END) as "errorLogs"
      FROM "Log"
      WHERE "timestamp" >= $1 AND "timestamp" <= $2
      GROUP BY "timeBucket"
      ORDER BY "timeBucket" ASC
    `;

    const results = await prisma.$queryRawUnsafe(query, startTime, endTime) as any[];

    return results.map(r => ({
      timestamp: r.timeBucket.toISOString(),
      totalLogs: parseInt(r.totalLogs, 10),
      errorLogs: parseInt(r.errorLogs, 10),
      errorRate: parseInt(r.totalLogs, 10) > 0 
        ? (parseInt(r.errorLogs, 10) / parseInt(r.totalLogs, 10)) * 100 
        : 0
    }));
  }

  async getRecentAlerts(limit: number = 10) {
    return alertService.getRecentAlerts(limit);
  }

  async getDashboardData(): Promise<{
    logLevelBreakdown: LogLevelBreakdown[];
    serviceRanking: ServiceRanking[];
    errorRateTrend: ErrorRateTrend[];
    recentAlerts: any[];
    summary: {
      totalLogsLast24h: number;
      errorLogsLast24h: number;
      activeAlerts: number;
      totalServices: number;
    };
  }> {
    const [
      logLevelBreakdown,
      serviceRanking,
      errorRateTrend,
      recentAlerts,
      summaryData
    ] = await Promise.all([
      this.getLogLevelBreakdown(1),
      this.getServiceRanking(24),
      this.getErrorRateTrend(24, '1h'),
      this.getRecentAlerts(10),
      this.getSummaryData()
    ]);

    return {
      logLevelBreakdown,
      serviceRanking,
      errorRateTrend,
      recentAlerts,
      summary: summaryData
    };
  }

  private async getSummaryData() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const [totalLogs, errorLogs, activeAlerts, totalServices] = await Promise.all([
      prisma.log.count({
        where: {
          timestamp: { gte: last24h, lte: now }
        }
      }),
      prisma.log.count({
        where: {
          timestamp: { gte: last24h, lte: now },
          level: LogLevel.ERROR
        }
      }),
      prisma.alert.count({
        where: {
          status: { in: ['ACTIVE', 'ACKNOWLEDGED'] }
        }
      }),
      prisma.service.count({
        where: { isActive: true }
      })
    ]);

    return {
      totalLogsLast24h: totalLogs,
      errorLogsLast24h: errorLogs,
      activeAlerts,
      totalServices
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;

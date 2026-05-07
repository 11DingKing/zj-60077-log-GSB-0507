import { LogLevel } from '@prisma/client';
import redis, { LOG_QUEUE_KEY, LOG_STREAM_CHANNEL } from '../lib/redis';
import prisma from '../lib/prisma';
import { LogEntry, QueuedLog, LogQueryParams, PaginatedResult, LogAggregationParams, AggregationResult } from '../types/log';

export class LogService {
  async validateAndPrepareLog(logEntry: LogEntry): Promise<QueuedLog> {
    if (!logEntry.timestamp || !logEntry.level || !logEntry.service || !logEntry.message) {
      throw new Error('Missing required fields: timestamp, level, service, message');
    }

    const validLevels = Object.values(LogLevel);
    if (!validLevels.includes(logEntry.level)) {
      throw new Error(`Invalid log level. Must be one of: ${validLevels.join(', ')}`);
    }

    const service = await prisma.service.findUnique({
      where: { name: logEntry.service }
    });

    if (!service) {
      throw new Error(`Service '${logEntry.service}' not found. Please register the service first.`);
    }

    return {
      ...logEntry,
      serviceId: service.id,
      receivedAt: new Date().toISOString(),
      metadata: logEntry.metadata || {}
    };
  }

  async queueLog(queuedLog: QueuedLog): Promise<void> {
    await redis.rpush(LOG_QUEUE_KEY, JSON.stringify(queuedLog));
    await redis.publish(LOG_STREAM_CHANNEL, JSON.stringify(queuedLog));
  }

  async receiveSingleLog(logEntry: LogEntry): Promise<void> {
    const preparedLog = await this.validateAndPrepareLog(logEntry);
    await this.queueLog(preparedLog);
  }

  async receiveBatchLogs(logEntries: LogEntry[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let successCount = 0;

    for (const [index, logEntry] of logEntries.entries()) {
      try {
        const preparedLog = await this.validateAndPrepareLog(logEntry);
        await this.queueLog(preparedLog);
        successCount++;
      } catch (error) {
        errors.push(`Log at index ${index}: ${(error as Error).message}`);
      }
    }

    return {
      success: successCount,
      failed: logEntries.length - successCount,
      errors
    };
  }

  async queryLogs(params: LogQueryParams): Promise<PaginatedResult<any>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (params.startTime) {
      where.timestamp = { gte: new Date(params.startTime) };
    }
    if (params.endTime) {
      where.timestamp = { ...where.timestamp, lte: new Date(params.endTime) };
    }
    if (params.levels && params.levels.length > 0) {
      where.level = { in: params.levels };
    }
    if (params.keyword) {
      where.message = { contains: params.keyword, mode: 'insensitive' };
    }

    if (params.serviceNames && params.serviceNames.length > 0) {
      const services = await prisma.service.findMany({
        where: { name: { in: params.serviceNames } },
        select: { id: true }
      });
      const serviceIds = services.map(s => s.id);
      if (serviceIds.length > 0) {
        where.serviceId = { in: serviceIds };
      }
    }

    const [total, logs] = await Promise.all([
      prisma.log.count({ where }),
      prisma.log.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
        include: { service: { select: { name: true } } }
      })
    ]);

    const formattedLogs = logs.map(log => ({
      ...log,
      serviceName: log.service.name
    }));

    return {
      data: formattedLogs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async aggregateLogs(params: LogAggregationParams): Promise<AggregationResult[]> {
    const { startTime, endTime, granularity, serviceNames } = params;
    const start = new Date(startTime);
    const end = new Date(endTime);

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

    let serviceIds: string[] | undefined;
    if (serviceNames && serviceNames.length > 0) {
      const services = await prisma.service.findMany({
        where: { name: { in: serviceNames } },
        select: { id: true }
      });
      serviceIds = services.map(s => s.id);
    }

    const query = `
      SELECT 
        date_trunc('${dateTrunc}', "timestamp") as "timeBucket",
        "serviceId",
        "level",
        COUNT(*) as "count"
      FROM "Log"
      WHERE "timestamp" >= $1 AND "timestamp" <= $2
      ${serviceIds && serviceIds.length > 0 ? `AND "serviceId" IN (${serviceIds.map((_, i) => `$${i + 3}`).join(', ')})` : ''}
      GROUP BY "timeBucket", "serviceId", "level"
      ORDER BY "timeBucket" ASC
    `;

    const paramsArray: any[] = [start, end];
    if (serviceIds && serviceIds.length > 0) {
      paramsArray.push(...serviceIds);
    }

    const results = await prisma.$queryRawUnsafe(query, ...paramsArray) as any[];

    const services = await prisma.service.findMany({ select: { id: true, name: true } });
    const serviceIdToName = new Map(services.map(s => [s.id, s.name]));

    return results.map(r => ({
      timestamp: r.timeBucket.toISOString(),
      serviceName: serviceIdToName.get(r.serviceId) || 'unknown',
      level: r.level,
      count: parseInt(r.count, 10)
    }));
  }

  async getServiceStats(startTime: string, endTime: string): Promise<any[]> {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const query = `
      SELECT 
        s.id as "serviceId",
        s.name as "serviceName",
        COUNT(l.id) as "totalLogs",
        COUNT(CASE WHEN l.level = 'ERROR' THEN 1 END) as "errorCount",
        COUNT(CASE WHEN l.level = 'WARN' THEN 1 END) as "warningCount"
      FROM "Service" s
      LEFT JOIN "Log" l ON s.id = l."serviceId" AND l."timestamp" >= $1 AND l."timestamp" <= $2
      GROUP BY s.id, s.name
      ORDER BY "totalLogs" DESC
    `;

    const results = await prisma.$queryRawUnsafe(query, start, end) as any[];

    return results.map(r => ({
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      totalLogs: parseInt(r.totalLogs, 10),
      errorCount: parseInt(r.errorCount, 10),
      warningCount: parseInt(r.warningCount, 10)
    }));
  }
}

export default new LogService();

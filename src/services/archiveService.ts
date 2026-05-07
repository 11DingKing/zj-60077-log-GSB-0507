import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import config from '../config';

interface ArchiveResult {
  archivedCount: number;
  deletedCount: number;
  error?: string;
}

export class ArchiveService {
  async archiveOldLogs(customRetentionDays?: number): Promise<ArchiveResult> {
    const retentionDays = customRetentionDays || config.logArchive.defaultRetentionDays;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    let archivedCount = 0;
    let deletedCount = 0;

    try {
      const oldLogs = await prisma.log.findMany({
        where: {
          timestamp: { lt: cutoffDate }
        },
        take: 1000
      });

      if (oldLogs.length === 0) {
        return { archivedCount: 0, deletedCount: 0 };
      }

      while (oldLogs.length > 0) {
        const batchToArchive = oldLogs.splice(0, 100);

        const archiveData = batchToArchive.map(log => ({
          originalId: log.id,
          timestamp: log.timestamp,
          level: log.level,
          serviceId: log.serviceId,
          message: log.message,
          metadata: log.metadata as Prisma.InputJsonValue,
          archivedAt: new Date()
        }));

        await prisma.$transaction(async (tx) => {
          await tx.logArchive.createMany({
            data: archiveData,
            skipDuplicates: true
          });

          const idsToDelete = batchToArchive.map(log => log.id);
          await tx.log.deleteMany({
            where: { id: { in: idsToDelete } }
          });
        });

        archivedCount += batchToArchive.length;
        deletedCount += batchToArchive.length;

        console.log(`Archived ${batchToArchive.length} logs, total archived: ${archivedCount}`);
      }

      return { archivedCount, deletedCount };
    } catch (error) {
      console.error('Error during archive:', error);
      return {
        archivedCount,
        deletedCount,
        error: (error as Error).message
      };
    }
  }

  async archiveLogsByService(serviceId: string, customRetentionDays?: number): Promise<ArchiveResult> {
    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    });

    if (!service) {
      throw new Error('Service not found');
    }

    const retentionDays = customRetentionDays || service.logRetentionDays || config.logArchive.defaultRetentionDays;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    let archivedCount = 0;
    let deletedCount = 0;

    try {
      const oldLogs = await prisma.log.findMany({
        where: {
          serviceId,
          timestamp: { lt: cutoffDate }
        },
        take: 1000
      });

      if (oldLogs.length === 0) {
        return { archivedCount: 0, deletedCount: 0 };
      }

      while (oldLogs.length > 0) {
        const batchToArchive = oldLogs.splice(0, 100);

        const archiveData = batchToArchive.map(log => ({
          originalId: log.id,
          timestamp: log.timestamp,
          level: log.level,
          serviceId: log.serviceId,
          message: log.message,
          metadata: log.metadata as Prisma.InputJsonValue,
          archivedAt: new Date()
        }));

        await prisma.$transaction(async (tx) => {
          await tx.logArchive.createMany({
            data: archiveData,
            skipDuplicates: true
          });

          const idsToDelete = batchToArchive.map(log => log.id);
          await tx.log.deleteMany({
            where: { id: { in: idsToDelete } }
          });
        });

        archivedCount += batchToArchive.length;
        deletedCount += batchToArchive.length;
      }

      return { archivedCount, deletedCount };
    } catch (error) {
      console.error('Error during service archive:', error);
      return {
        archivedCount,
        deletedCount,
        error: (error as Error).message
      };
    }
  }

  async getArchiveStats(): Promise<{
    totalArchivedLogs: number;
    totalActiveLogs: number;
    oldestArchiveDate: Date | null;
    newestArchiveDate: Date | null;
  }> {
    const [totalArchived, totalActive, oldestArchive, newestArchive] = await Promise.all([
      prisma.logArchive.count(),
      prisma.log.count(),
      prisma.logArchive.findFirst({
        orderBy: { archivedAt: 'asc' },
        select: { archivedAt: true }
      }),
      prisma.logArchive.findFirst({
        orderBy: { archivedAt: 'desc' },
        select: { archivedAt: true }
      })
    ]);

    return {
      totalArchivedLogs: totalArchived,
      totalActiveLogs: totalActive,
      oldestArchiveDate: oldestArchive?.archivedAt || null,
      newestArchiveDate: newestArchive?.archivedAt || null
    };
  }

  async queryArchivedLogs(
    startTime?: string,
    endTime?: string,
    serviceNames?: string[],
    page: number = 1,
    pageSize: number = 20
  ): Promise<any> {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (startTime) {
      where.timestamp = { gte: new Date(startTime) };
    }
    if (endTime) {
      where.timestamp = { ...where.timestamp, lte: new Date(endTime) };
    }

    if (serviceNames && serviceNames.length > 0) {
      const services = await prisma.service.findMany({
        where: { name: { in: serviceNames } },
        select: { id: true }
      });
      const serviceIds = services.map(s => s.id);
      if (serviceIds.length > 0) {
        where.serviceId = { in: serviceIds };
      }
    }

    const [total, logs] = await Promise.all([
      prisma.logArchive.count({ where }),
      prisma.logArchive.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    const services = await prisma.service.findMany({ select: { id: true, name: true } });
    const serviceIdToName = new Map(services.map(s => [s.id, s.name]));

    const formattedLogs = logs.map(log => ({
      ...log,
      serviceName: serviceIdToName.get(log.serviceId) || 'unknown'
    }));

    return {
      data: formattedLogs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

export const archiveService = new ArchiveService();
export default archiveService;

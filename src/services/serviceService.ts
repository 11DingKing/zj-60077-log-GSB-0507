import prisma from '../lib/prisma';

interface CreateServiceData {
  name: string;
  description?: string;
  logRetentionDays?: number;
  alertContacts?: string[];
}

interface UpdateServiceData {
  description?: string;
  logRetentionDays?: number;
  alertContacts?: string[];
  isActive?: boolean;
}

export class ServiceService {
  async createService(data: CreateServiceData) {
    const existingService = await prisma.service.findUnique({
      where: { name: data.name }
    });

    if (existingService) {
      throw new Error(`Service with name '${data.name}' already exists`);
    }

    return prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        logRetentionDays: data.logRetentionDays || 30,
        alertContacts: data.alertContacts || [],
        isActive: true
      }
    });
  }

  async getServiceById(id: string) {
    return prisma.service.findUnique({
      where: { id }
    });
  }

  async getServiceByName(name: string) {
    return prisma.service.findUnique({
      where: { name }
    });
  }

  async getAllServices(includeInactive: boolean = false) {
    const where = includeInactive ? {} : { isActive: true };
    return prisma.service.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateService(id: string, data: UpdateServiceData) {
    return prisma.service.update({
      where: { id },
      data: {
        description: data.description,
        logRetentionDays: data.logRetentionDays,
        alertContacts: data.alertContacts,
        isActive: data.isActive
      }
    });
  }

  async deleteService(id: string) {
    const service = await prisma.service.findUnique({
      where: { id },
      include: { logs: { take: 1 } }
    });

    if (!service) {
      throw new Error('Service not found');
    }

    if (service.logs.length > 0) {
      return prisma.service.update({
        where: { id },
        data: { isActive: false }
      });
    }

    return prisma.service.delete({
      where: { id }
    });
  }

  async getServiceStats(serviceId: string, startTime?: Date, endTime?: Date) {
    const start = startTime || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endTime || new Date();

    const logs = await prisma.log.groupBy({
      by: ['level'],
      where: {
        serviceId,
        timestamp: {
          gte: start,
          lte: end
        }
      },
      _count: {
        _all: true
      }
    });

    const totalLogs = logs.reduce((sum, log) => sum + log._count._all, 0);
    
    const levelCounts: Record<string, number> = {};
    logs.forEach(log => {
      levelCounts[log.level] = log._count._all;
    });

    return {
      serviceId,
      totalLogs,
      levelCounts,
      timeRange: { start, end }
    };
  }
}

export default new ServiceService();

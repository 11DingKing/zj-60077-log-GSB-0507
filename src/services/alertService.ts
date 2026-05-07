import { AlertStatus, LogLevel } from '@prisma/client';
import prisma from '../lib/prisma';

interface CreateAlertRuleData {
  serviceId: string;
  name: string;
  description?: string;
  timeWindowMinutes?: number;
  threshold?: number;
}

interface UpdateAlertRuleData {
  name?: string;
  description?: string;
  timeWindowMinutes?: number;
  threshold?: number;
  isEnabled?: boolean;
}

export class AlertService {
  async createAlertRule(data: CreateAlertRuleData) {
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId }
    });

    if (!service) {
      throw new Error('Service not found');
    }

    return prisma.alertRule.create({
      data: {
        serviceId: data.serviceId,
        name: data.name,
        description: data.description,
        timeWindowMinutes: data.timeWindowMinutes || 5,
        threshold: data.threshold || 10,
        isEnabled: true
      }
    });
  }

  async getAlertRuleById(id: string) {
    return prisma.alertRule.findUnique({
      where: { id },
      include: { service: true }
    });
  }

  async getAlertRulesByService(serviceId: string) {
    return prisma.alertRule.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllAlertRules(includeDisabled: boolean = false) {
    const where = includeDisabled ? {} : { isEnabled: true };
    return prisma.alertRule.findMany({
      where,
      include: { service: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateAlertRule(id: string, data: UpdateAlertRuleData) {
    return prisma.alertRule.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        timeWindowMinutes: data.timeWindowMinutes,
        threshold: data.threshold,
        isEnabled: data.isEnabled
      }
    });
  }

  async deleteAlertRule(id: string) {
    return prisma.alertRule.delete({
      where: { id }
    });
  }

  async checkAndTriggerAlerts(): Promise<void> {
    const rules = await prisma.alertRule.findMany({
      where: { isEnabled: true }
    });

    for (const rule of rules) {
      const windowStart = new Date(Date.now() - rule.timeWindowMinutes * 60 * 1000);
      
      const errorCount = await prisma.log.count({
        where: {
          serviceId: rule.serviceId,
          level: LogLevel.ERROR,
          timestamp: { gte: windowStart }
        }
      });

      if (errorCount >= rule.threshold) {
        await this.triggerAlert(rule.id, rule.serviceId, errorCount, rule.threshold);
      }
    }
  }

  private async triggerAlert(ruleId: string, serviceId: string, errorCount: number, threshold: number): Promise<void> {
    const existingActiveAlert = await prisma.alert.findFirst({
      where: {
        ruleId,
        status: AlertStatus.ACTIVE
      }
    });

    if (existingActiveAlert) {
      return;
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    });

    await prisma.alert.create({
      data: {
        ruleId,
        serviceId,
        status: AlertStatus.ACTIVE,
        message: `Service '${service?.name}' exceeded error threshold: ${errorCount} errors in time window (threshold: ${threshold})`,
        metadata: {
          errorCount,
          threshold
        }
      }
    });

    console.log(`Alert triggered for service ${service?.name}: ${errorCount} errors`);
  }

  async getAlerts(
    status?: AlertStatus,
    serviceId?: string,
    page: number = 1,
    pageSize: number = 20
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (serviceId) {
      where.serviceId = serviceId;
    }

    const [total, alerts] = await Promise.all([
      prisma.alert.count({ where }),
      prisma.alert.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          rule: true,
          service: true
        }
      })
    ]);

    return {
      data: alerts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy
      }
    });
  }

  async resolveAlert(alertId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date()
      }
    });
  }

  async getRecentAlerts(limit: number = 10) {
    return prisma.alert.findMany({
      orderBy: { triggeredAt: 'desc' },
      take: limit,
      include: {
        rule: true,
        service: true
      }
    });
  }
}

export const alertService = new AlertService();
export default alertService;

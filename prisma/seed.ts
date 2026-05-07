import { PrismaClient, LogLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const services = [
    {
      name: 'user-service',
      description: '用户认证与管理服务',
      logRetentionDays: 30,
      alertContacts: ['admin@example.com', 'dev@example.com']
    },
    {
      name: 'order-service',
      description: '订单处理与管理服务',
      logRetentionDays: 60,
      alertContacts: ['ops@example.com']
    },
    {
      name: 'payment-service',
      description: '支付处理服务',
      logRetentionDays: 90,
      alertContacts: ['finance@example.com', 'sec@example.com']
    },
    {
      name: 'notification-service',
      description: '通知与消息推送服务',
      logRetentionDays: 15,
      alertContacts: ['support@example.com']
    },
    {
      name: 'api-gateway',
      description: 'API 网关服务',
      logRetentionDays: 30,
      alertContacts: ['dev@example.com', 'ops@example.com']
    }
  ];

  console.log('Creating services...');
  for (const service of services) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: {},
      create: {
        name: service.name,
        description: service.description,
        logRetentionDays: service.logRetentionDays,
        alertContacts: service.alertContacts,
        isActive: true
      }
    });
  }

  const createdServices = await prisma.service.findMany();
  console.log(`Created ${createdServices.length} services`);

  console.log('Creating sample logs...');
  const logMessages = {
    [LogLevel.DEBUG]: [
      'User session validation passed for user_id: {}',
      'Cache hit for key: {}',
      'Database query executed in {}ms',
      'Request headers: {}',
      'Configuration loaded from {}'
    ],
    [LogLevel.INFO]: [
      'User {} logged in successfully',
      'Order {} created successfully',
      'Payment of ${} processed for user {}',
      'Notification sent to user {} via {}',
      'API request completed: {} {} - {}ms',
      'Service started on port {}',
      'Health check passed',
      'Scheduled task {} executed successfully'
    ],
    [LogLevel.WARN]: [
      'Rate limit approaching for API key: {}',
      'Database query took longer than expected: {}ms',
      'High memory usage detected: {}%',
      'Retry attempt {} for operation: {}',
      'Deprecated API endpoint called: {}',
      'Cache miss rate high: {}%'
    ],
    [LogLevel.ERROR]: [
      'Database connection failed: {}',
      'User authentication failed for user: {}',
      'Payment processing failed with error: {}',
      'External API call failed: {} - {}',
      'Null pointer exception in service {}',
      'Timeout while waiting for response from {}',
      'Failed to send notification to user {}: {}'
    ],
    [LogLevel.FATAL]: [
      'Service crashed: out of memory error',
      'Database corruption detected, emergency shutdown',
      'Critical security breach detected'
    ]
  };

  const now = new Date();
  const logsToCreate: any[] = [];

  for (const service of createdServices) {
    const logCount = 100 + Math.floor(Math.random() * 200);
    
    for (let i = 0; i < logCount; i++) {
      const random = Math.random();
      let level: LogLevel;
      if (random < 0.1) {
        level = LogLevel.DEBUG;
      } else if (random < 0.6) {
        level = LogLevel.INFO;
      } else if (random < 0.8) {
        level = LogLevel.WARN;
      } else if (random < 0.98) {
        level = LogLevel.ERROR;
      } else {
        level = LogLevel.FATAL;
      }

      const messages = logMessages[level];
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      const hoursAgo = Math.floor(Math.random() * 48);
      const minutesAgo = Math.floor(Math.random() * 60);
      const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000 - minutesAgo * 60 * 1000);

      const metadata = {
        requestId: `req_${Math.random().toString(36).substring(7)}`,
        userId: level !== LogLevel.FATAL ? Math.floor(Math.random() * 10000) : null,
        environment: 'production',
        traceId: `trace_${Math.random().toString(36).substring(9)}`,
        durationMs: level === LogLevel.WARN ? Math.floor(Math.random() * 5000) : Math.floor(Math.random() * 500)
      };

      logsToCreate.push({
        timestamp,
        level,
        serviceId: service.id,
        message,
        metadata
      });
    }
  }

  logsToCreate.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const batchSize = 500;
  for (let i = 0; i < logsToCreate.length; i += batchSize) {
    const batch = logsToCreate.slice(i, i + batchSize);
    await prisma.log.createMany({
      data: batch,
      skipDuplicates: true
    });
    console.log(`Created ${Math.min(i + batchSize, logsToCreate.length)} logs...`);
  }

  console.log(`Created total ${logsToCreate.length} sample logs`);

  console.log('Creating alert rules...');
  const alertRules = [
    {
      serviceName: 'user-service',
      name: 'High Error Rate',
      description: '当5分钟内错误日志超过5条时触发告警',
      timeWindowMinutes: 5,
      threshold: 5
    },
    {
      serviceName: 'payment-service',
      name: 'Payment Errors',
      description: '支付服务错误告警 - 10分钟内超过3条错误',
      timeWindowMinutes: 10,
      threshold: 3
    },
    {
      serviceName: 'api-gateway',
      name: 'Gateway Errors',
      description: '网关错误告警 - 每分钟超过10条错误',
      timeWindowMinutes: 1,
      threshold: 10
    }
  ];

  for (const rule of alertRules) {
    const service = createdServices.find(s => s.name === rule.serviceName);
    if (service) {
      await prisma.alertRule.upsert({
        where: {
          id: `rule_${rule.serviceName}`
        },
        update: {},
        create: {
          id: `rule_${rule.serviceName}`,
          serviceId: service.id,
          name: rule.name,
          description: rule.description,
          timeWindowMinutes: rule.timeWindowMinutes,
          threshold: rule.threshold,
          isEnabled: true
        }
      });
    }
  }

  console.log('Seeding completed!');
  console.log('\nSummary:');
  console.log(`- Services: ${createdServices.length}`);
  console.log(`- Logs: ${logsToCreate.length}`);
  console.log(`- Alert Rules: ${alertRules.length}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

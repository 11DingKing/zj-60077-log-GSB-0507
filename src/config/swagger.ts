import swaggerJSDoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Log Collection Platform API',
      version: '1.0.0',
      description: '日志收集与分析平台 API 文档',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api`,
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        LogLevel: {
          type: 'string',
          enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
        },
        LogEntry: {
          type: 'object',
          required: ['timestamp', 'level', 'service', 'message'],
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: '日志时间戳'
            },
            level: {
              $ref: '#/components/schemas/LogLevel'
            },
            service: {
              type: 'string',
              description: '服务名称'
            },
            message: {
              type: 'string',
              description: '日志消息'
            },
            metadata: {
              type: 'object',
              description: '额外元数据'
            }
          }
        },
        Service: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string',
              nullable: true
            },
            logRetentionDays: {
              type: 'integer',
              default: 30
            },
            alertContacts: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            isActive: {
              type: 'boolean',
              default: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        AlertRule: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            serviceId: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string',
              nullable: true
            },
            timeWindowMinutes: {
              type: 'integer',
              default: 5,
              description: '时间窗口（分钟）'
            },
            threshold: {
              type: 'integer',
              default: 10,
              description: 'ERROR 日志阈值'
            },
            isEnabled: {
              type: 'boolean',
              default: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Alert: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            ruleId: {
              type: 'string',
              format: 'uuid'
            },
            serviceId: {
              type: 'string',
              format: 'uuid'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'RESOLVED', 'ACKNOWLEDGED']
            },
            triggeredAt: {
              type: 'string',
              format: 'date-time'
            },
            resolvedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            acknowledgedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            acknowledgedBy: {
              type: 'string',
              nullable: true
            },
            message: {
              type: 'string'
            },
            metadata: {
              type: 'object'
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;

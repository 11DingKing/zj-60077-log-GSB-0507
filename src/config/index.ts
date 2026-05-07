import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '13077', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://dev:dev123456@localhost:15077/db_zj_60077?schema=public'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '16377', 10),
    password: process.env.REDIS_PASSWORD || undefined
  },
  
  logPersistence: {
    batchSize: parseInt(process.env.LOG_BATCH_SIZE || '100', 10),
    flushInterval: parseInt(process.env.LOG_FLUSH_INTERVAL || '5000', 10)
  },
  
  logArchive: {
    defaultRetentionDays: parseInt(process.env.LOG_ARCHIVE_DAYS || '30', 10)
  }
};

export default config;

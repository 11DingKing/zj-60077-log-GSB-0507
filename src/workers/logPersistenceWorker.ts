import { LogLevel, Prisma } from '@prisma/client';
import redis, { LOG_QUEUE_KEY } from '../lib/redis';
import prisma from '../lib/prisma';
import config from '../config';

interface QueuedLog {
  timestamp: string;
  level: LogLevel;
  service: string;
  serviceId: string;
  message: string;
  metadata: Record<string, unknown>;
  receivedAt: string;
}

export class LogPersistenceWorker {
  private isRunning: boolean = false;
  private batch: QueuedLog[] = [];
  private lastFlushTime: number = Date.now();
  private flushTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isRunning) return;
    
    console.log('Starting log persistence worker...');
    this.isRunning = true;
    this.scheduleFlush();
    this.startPolling();
  }

  stop(): void {
    console.log('Stopping log persistence worker...');
    this.isRunning = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    
    if (this.batch.length > 0) {
      this.flush().catch(err => {
        console.error('Error flushing remaining logs:', err);
      });
    }
  }

  private scheduleFlush(): void {
    this.flushTimer = setInterval(() => {
      this.checkAndFlush().catch(err => {
        console.error('Error in scheduled flush:', err);
      });
    }, 1000);
  }

  private async checkAndFlush(): Promise<void> {
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    const shouldFlushByTime = timeSinceLastFlush >= config.logPersistence.flushInterval;
    const shouldFlushBySize = this.batch.length >= config.logPersistence.batchSize;

    if (shouldFlushByTime || shouldFlushBySize) {
      if (this.batch.length > 0) {
        await this.flush();
      }
      this.lastFlushTime = now;
    }
  }

  private async flush(): Promise<void> {
    const logsToProcess = [...this.batch];
    this.batch = [];

    if (logsToProcess.length === 0) return;

    try {
      console.log(`Flushing ${logsToProcess.length} logs to database...`);
      
      const logData = logsToProcess.map(log => ({
        timestamp: new Date(log.timestamp),
        level: log.level,
        serviceId: log.serviceId,
        message: log.message,
        metadata: log.metadata as Prisma.InputJsonValue
      }));

      await prisma.log.createMany({
        data: logData,
        skipDuplicates: true
      });

      console.log(`Successfully persisted ${logsToProcess.length} logs`);
    } catch (error) {
      console.error('Error flushing logs:', error);
      this.batch.unshift(...logsToProcess);
    }
  }

  private startPolling(): void {
    this.poll();
  }

  private poll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      try {
        await this.consumeBatch();
      } catch (error) {
        console.error('Error consuming from Redis queue:', error);
      } finally {
        this.poll();
      }
    }, 100);
  }

  private async consumeBatch(): Promise<void> {
    const maxBatchSize = config.logPersistence.batchSize - this.batch.length;
    
    if (maxBatchSize <= 0) {
      await this.checkAndFlush();
      return;
    }

    const logs = await redis.lpop(LOG_QUEUE_KEY, Math.min(maxBatchSize, 100));
    
    if (!logs || logs.length === 0) {
      return;
    }

    for (const logStr of logs) {
      try {
        const log = JSON.parse(logStr) as QueuedLog;
        this.batch.push(log);
      } catch (error) {
        console.error('Error parsing log from queue:', error);
      }
    }

    await this.checkAndFlush();
  }
}

export const logPersistenceWorker = new LogPersistenceWorker();
export default logPersistenceWorker;

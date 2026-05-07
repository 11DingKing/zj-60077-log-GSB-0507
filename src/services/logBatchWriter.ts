import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { QueuedLog } from '../types/log';

export interface LogBatchWriterConfig {
  batchSize?: number;
  flushInterval?: number;
}

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL = 5000;

export class LogBatchWriter {
  private batch: QueuedLog[] = [];
  private lastFlushTime: number = Date.now();
  private flushTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private batchSize: number;
  private flushInterval: number;
  private onFlush?: (count: number) => void;

  constructor(config?: LogBatchWriterConfig, onFlush?: (count: number) => void) {
    this.batchSize = config?.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushInterval = config?.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
    this.onFlush = onFlush;
  }

  start(): void {
    if (this.isRunning) return;
    console.log('Starting log batch writer...');
    this.isRunning = true;
    this.lastFlushTime = Date.now();
    this.scheduleFlush();
  }

  async stop(): Promise<void> {
    console.log('Stopping log batch writer...');
    this.isRunning = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.batch.length > 0) {
      await this.flush().catch(err => {
        console.error('Error flushing remaining logs:', err);
      });
    }
  }

  addLogs(logs: QueuedLog[]): void {
    this.batch.push(...logs);
  }

  getPendingCount(): number {
    return this.batch.length;
  }

  async checkAndFlush(): Promise<void> {
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    const shouldFlushByTime = timeSinceLastFlush >= this.flushInterval;
    const shouldFlushBySize = this.batch.length >= this.batchSize;

    if (shouldFlushByTime || shouldFlushBySize) {
      if (this.batch.length > 0) {
        await this.flush();
      }
      this.lastFlushTime = now;
    }
  }

  async forceFlush(): Promise<void> {
    if (this.batch.length > 0) {
      await this.flush();
      this.lastFlushTime = Date.now();
    }
  }

  private scheduleFlush(): void {
    this.flushTimer = setInterval(() => {
      this.checkAndFlush().catch(err => {
        console.error('Error in scheduled flush:', err);
      });
    }, 1000);
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
      if (this.onFlush) {
        this.onFlush(logsToProcess.length);
      }
    } catch (error) {
      console.error('Error flushing logs:', error);
      this.batch.unshift(...logsToProcess);
    }
  }
}

export default LogBatchWriter;

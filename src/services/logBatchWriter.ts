import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { QueuedLog } from '../types/log';

export interface BatchWriterOptions {
  batchSize: number;
  flushInterval: number;
}

export class LogBatchWriter {
  private batch: QueuedLog[] = [];
  private lastFlushTime: number = Date.now();
  private flushTimer: NodeJS.Timeout | null = null;
  private options: BatchWriterOptions;

  constructor(options: BatchWriterOptions) {
    this.options = options;
  }

  add(log: QueuedLog): boolean {
    this.batch.push(log);
    return this.needsFlush();
  }

  addMany(logs: QueuedLog[]): boolean {
    this.batch.push(...logs);
    return this.needsFlush();
  }

  getBatchSize(): number {
    return this.batch.length;
  }

  getRemainingCapacity(): number {
    return Math.max(0, this.options.batchSize - this.batch.length);
  }

  startScheduledFlush(onFlush: (flushed: QueuedLog[]) => Promise<void>): void {
    this.flushTimer = setInterval(async () => {
      if (this.needsFlush() && this.batch.length > 0) {
        await this.flush(onFlush);
      }
    }, 1000);
  }

  stopScheduledFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async flush(onFlush: (flushed: QueuedLog[]) => Promise<void>): Promise<void> {
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
      this.lastFlushTime = Date.now();

      await onFlush(logsToProcess);
    } catch (error) {
      console.error('Error flushing logs:', error);
      this.batch.unshift(...logsToProcess);
    }
  }

  async forceFlush(onFlush: (flushed: QueuedLog[]) => Promise<void>): Promise<void> {
    if (this.batch.length > 0) {
      await this.flush(onFlush);
    }
  }

  needsFlush(): boolean {
    const timeSinceLastFlush = Date.now() - this.lastFlushTime;
    const shouldFlushByTime = timeSinceLastFlush >= this.options.flushInterval;
    const shouldFlushBySize = this.batch.length >= this.options.batchSize;
    return shouldFlushByTime || shouldFlushBySize;
  }
}

export function createLogBatchWriter(options?: Partial<BatchWriterOptions>): LogBatchWriter {
  const resolvedOptions: BatchWriterOptions = {
    batchSize: options?.batchSize ?? 100,
    flushInterval: options?.flushInterval ?? 5000
  };
  return new LogBatchWriter(resolvedOptions);
}

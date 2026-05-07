import config from '../config';
import { QueueConsumer } from './queue-consumer';
import { LogBatchWriter, createLogBatchWriter } from '../services/logBatchWriter';
import { matchAlerts } from '../services/alertMatcher';

export class LogPersistenceWorker {
  private consumer: QueueConsumer | null = null;
  private batchWriter: LogBatchWriter;

  constructor() {
    this.batchWriter = createLogBatchWriter({
      batchSize: config.logPersistence.batchSize,
      flushInterval: config.logPersistence.flushInterval
    });
  }

  start(): void {
    console.log('Starting log persistence worker...');

    this.batchWriter.startScheduledFlush(async (flushedLogs) => {
      await this.afterFlush(flushedLogs);
    });

    this.consumer = new QueueConsumer({
      onLogs: async (logs) => {
        this.batchWriter.addMany(logs);
        if (this.batchWriter.needsFlush()) {
          await this.batchWriter.flush(async (flushedLogs) => {
            await this.afterFlush(flushedLogs);
          });
        }
      }
    }, {
      maxPopCount: Math.min(config.logPersistence.batchSize, 100)
    });

    this.consumer.start();
  }

  stop(): void {
    console.log('Stopping log persistence worker...');
    this.consumer?.stop();
    this.batchWriter.stopScheduledFlush();
    this.batchWriter.forceFlush(async (flushedLogs) => {
      await this.afterFlush(flushedLogs);
    }).catch(err => {
      console.error('Error flushing remaining logs:', err);
    });
  }

  private async afterFlush(_flushedLogs: any[]): Promise<void> {
    await matchAlerts();
  }
}

export const logPersistenceWorker = new LogPersistenceWorker();
export default logPersistenceWorker;

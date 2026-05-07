import config from '../config';
import { QueueConsumer, startConsumer } from './queue-consumer';
import LogBatchWriter from '../services/logBatchWriter';
import alertMatcher from '../services/alertMatcher';
import { QueuedLog } from '../types/log';

export class LogPersistenceWorker {
  private consumer: QueueConsumer | null = null;
  private batchWriter: LogBatchWriter | null = null;
  private isRunning: boolean = false;

  start(): void {
    if (this.isRunning) return;

    console.log('Starting log persistence worker...');
    this.isRunning = true;

    this.batchWriter = new LogBatchWriter({
      batchSize: config.logPersistence.batchSize,
      flushInterval: config.logPersistence.flushInterval
    });
    this.batchWriter.start();

    this.consumer = startConsumer(
      async (logs: QueuedLog[]) => await this.handleLogs(logs),
      { maxPopSize: 100, pollInterval: 100 }
    );
  }

  stop(): void {
    console.log('Stopping log persistence worker...');
    this.isRunning = false;

    if (this.consumer) {
      this.consumer.stop();
      this.consumer = null;
    }

    if (this.batchWriter) {
      this.batchWriter.stop().catch(err => {
        console.error('Error stopping batch writer:', err);
      });
      this.batchWriter = null;
    }
  }

  private async handleLogs(logs: QueuedLog[]): Promise<void> {
    if (!this.batchWriter) return;

    this.batchWriter.addLogs(logs);
    await this.batchWriter.checkAndFlush();
    await alertMatcher.checkIfNeeded();
  }
}

export const logPersistenceWorker = new LogPersistenceWorker();
export default logPersistenceWorker;

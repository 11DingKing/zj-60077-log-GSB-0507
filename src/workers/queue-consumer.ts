import redis, { LOG_QUEUE_KEY } from '../lib/redis';
import { QueuedLog } from '../types/log';

export interface ConsumerConfig {
  pollInterval?: number;
  maxPopSize?: number;
}

export type OnMessageCallback = (logs: QueuedLog[]) => Promise<void>;

const DEFAULT_POLL_INTERVAL = 100;
const DEFAULT_MAX_POP_SIZE = 100;

export class QueueConsumer {
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private onMessage: OnMessageCallback;
  private pollInterval: number;
  private maxPopSize: number;

  constructor(onMessage: OnMessageCallback, config?: ConsumerConfig) {
    this.onMessage = onMessage;
    this.pollInterval = config?.pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.maxPopSize = config?.maxPopSize ?? DEFAULT_MAX_POP_SIZE;
  }

  start(): void {
    if (this.isRunning) return;
    console.log('Starting queue consumer...');
    this.isRunning = true;
    this.poll();
  }

  stop(): void {
    console.log('Stopping queue consumer...');
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
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
    }, this.pollInterval);
  }

  private async consumeBatch(): Promise<void> {
    const logs = await redis.lpop(LOG_QUEUE_KEY, this.maxPopSize);

    if (!logs || logs.length === 0) {
      return;
    }

    const parsedLogs: QueuedLog[] = [];
    for (const logStr of logs) {
      try {
        const log = JSON.parse(logStr) as QueuedLog;
        parsedLogs.push(log);
      } catch (error) {
        console.error('Error parsing log from queue:', error);
      }
    }

    if (parsedLogs.length > 0) {
      await this.onMessage(parsedLogs);
    }
  }
}

export function startConsumer(
  onMessage: OnMessageCallback,
  config?: ConsumerConfig
): QueueConsumer {
  const consumer = new QueueConsumer(onMessage, config);
  consumer.start();
  return consumer;
}

export default QueueConsumer;

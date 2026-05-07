import redis, { LOG_QUEUE_KEY } from '../lib/redis';
import { QueuedLog } from '../types/log';

export interface ConsumerCallbacks {
  onLogs: (logs: QueuedLog[]) => Promise<void>;
  onEmpty?: () => void;
}

export interface ConsumerOptions {
  pollInterval: number;
  maxPopCount: number;
}

const DEFAULT_OPTIONS: ConsumerOptions = {
  pollInterval: 100,
  maxPopCount: 100
};

export class QueueConsumer {
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private callbacks: ConsumerCallbacks;
  private options: ConsumerOptions;

  constructor(callbacks: ConsumerCallbacks, options?: Partial<ConsumerOptions>) {
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Starting queue consumer...');
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('Queue consumer stopped');
  }

  getIsRunning(): boolean {
    return this.isRunning;
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
    }, this.options.pollInterval);
  }

  private async consumeBatch(): Promise<void> {
    const logs = await redis.lpop(LOG_QUEUE_KEY, this.options.maxPopCount);

    if (!logs || logs.length === 0) {
      this.callbacks.onEmpty?.();
      return;
    }

    const parsedLogs: QueuedLog[] = [];
    for (const logStr of logs) {
      try {
        parsedLogs.push(JSON.parse(logStr) as QueuedLog);
      } catch (error) {
        console.error('Error parsing log from queue:', error);
      }
    }

    if (parsedLogs.length > 0) {
      await this.callbacks.onLogs(parsedLogs);
    }
  }
}

export function startConsumer(
  callbacks: ConsumerCallbacks,
  options?: Partial<ConsumerOptions>
): QueueConsumer {
  const consumer = new QueueConsumer(callbacks, options);
  consumer.start();
  return consumer;
}

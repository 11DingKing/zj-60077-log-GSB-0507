import Redis from 'ioredis';
import config from '../config';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

export const LOG_QUEUE_KEY = 'logs:queue';
export const LOG_STREAM_CHANNEL = 'logs:stream';

export default redis;

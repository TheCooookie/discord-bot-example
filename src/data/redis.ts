import Redis from 'ioredis';

// Redis is optional: leave REDIS_HOST empty to run without it.
const redisClient = process.env.REDIS_HOST
  ? new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: times => Math.min(times * 50, 2000),
    })
  : null;

/** Pings Redis if it is configured. Throws if it is unreachable, so the bot does not start without it. */
export async function testRedisConnection(): Promise<void> {
  if (!redisClient) {
    console.log('[Redis] REDIS_HOST not set, running without Redis.');
    return;
  }
  const pingResponse = await redisClient.ping();
  if (pingResponse !== 'PONG') {
    throw new Error(`[Redis Test] Unexpected PING response: ${pingResponse}`);
  }
  console.log('[Redis Test] Connection successful. PING response: PONG');
}

export default redisClient;

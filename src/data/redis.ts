import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD;

if (!redisHost || !redisPort) {
  throw new Error('[Redis] Missing REDIS_HOST or REDIS_PORT in environment variables.');
}

const redisClient = new Redis({
  host: redisHost,
  port: parseInt(redisPort, 10),
  password: redisPassword,
  retryStrategy: times => Math.min(times * 50, 2000),
});

/** Pings Redis. Throws if it is unreachable, so the bot does not start without it. */
export async function testRedisConnection(): Promise<void> {
  const pingResponse = await redisClient.ping();
  if (pingResponse !== 'PONG') {
    throw new Error(`[Redis Test] Unexpected PING response: ${pingResponse}`);
  }
  console.log('[Redis Test] Connection successful. PING response: PONG');
}

export default redisClient;

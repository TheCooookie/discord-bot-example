import Redis from 'ioredis';

// Env vars are loaded by `import 'dotenv/config'` at the top of bot.ts.
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

// Throws so initializeApp() stops the bot when Redis is unreachable.
export async function testRedisConnection(): Promise<void> {
  const pingResponse = await redisClient.ping();
  if (pingResponse !== 'PONG') {
    throw new Error(`[Redis Test] Unexpected PING response: ${pingResponse}`);
  }
  console.log('[Redis Test] Connection successful. PING response: PONG');
}

export default redisClient;

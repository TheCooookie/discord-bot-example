import redisClient from './redis';

// Throws so initializeApp() stops the bot when Redis is unreachable.
export async function testRedisConnection(): Promise<void> {
  const pingResponse = await redisClient.ping();
  if (pingResponse !== 'PONG') {
    throw new Error(`[Redis Test] Unexpected PING response: ${pingResponse}`);
  }
  console.log('[Redis Test] Connection successful. PING response: PONG');
}

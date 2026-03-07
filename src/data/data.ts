import redisClient from './redis';

export async function testRedisConnection(): Promise<void> {
  try {
    const pingResponse = await redisClient.ping();
    if (pingResponse === 'PONG') {
      console.log('[Redis Test] Connection successful. PING response: PONG');
    } else {
      console.error('[Redis Test] Connection test failed. Unexpected PING response:', pingResponse);
    }
  } catch (error) {
    console.error('[Redis Test] Failed to connect or PING Redis:', error);
  }
}

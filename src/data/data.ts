import redisClient from './redis';
import sequelize from './database';

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

export async function testDatabaseConnection(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('[Database Test] Connection has been established successfully.');
  } catch (error) {
    console.error('[Database Test] Unable to connect to the database:', error);
  }
}
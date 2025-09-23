import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD;

if (!redisHost || !redisPort) {
  console.error('[Redis] Missing REDIS_HOST or REDIS_PORT in environment variables.');
}

const redisClient = new Redis({
  host: redisHost,
  port: parseInt(redisPort || '6379', 10),
  password: redisPassword,
  retryStrategy: times => Math.min(times * 50, 2000),
});

export default redisClient;
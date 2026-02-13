import { jest } from '@jest/globals';
import redisClient, { closeRedis } from '../config/redis.js';
import tokenBucket from '../ratelimit/tokenBucket.js';

// Increase timeout for Redis operations
jest.setTimeout(10000);

describe('Token Bucket Algorithm', () => {
  const testKey = 'test_user_1';
  const capacity = 10;
  const refillRate = 1; // 1 token per second

  // Clean up before running
  beforeAll(async () => {
    // Wait for connection
    if (redisClient.status !== 'ready') {
        await new Promise((resolve) => redisClient.once('ready', resolve));
    }
    await redisClient.del(`rl:tb:tokens:${testKey}`);
    await redisClient.del(`rl:tb:time:${testKey}`);
  });

  afterAll(async () => {
    await redisClient.del(`rl:tb:tokens:${testKey}`);
    await redisClient.del(`rl:tb:time:${testKey}`);
    await closeRedis();
  });

  test('should allow request when bucket is full', async () => {
    const result = await tokenBucket.consume(testKey, capacity, refillRate, 1);
    expect(result.allowed).toBe(true);
    // Should be roughly 9 (capacity 10 - cost 1)
    expect(result.remainingTokens).toBeLessThanOrEqual(9);
  });

  test('should reduce tokens on subsequent requests', async () => {
    const result = await tokenBucket.consume(testKey, capacity, refillRate, 4);
    expect(result.allowed).toBe(true);
    // Previous was ~9, minus 4 = ~5
    expect(result.remainingTokens).toBeLessThanOrEqual(5);
  });

  test('should deny request when not enough tokens', async () => {
    // Consume all remaining tokens (approx 5 left)
    await tokenBucket.consume(testKey, capacity, refillRate, 6);
    
    // Now try to consume 10 more
    const result = await tokenBucket.consume(testKey, capacity, refillRate, 10);
    expect(result.allowed).toBe(false);
  });

  test('should refill tokens over time', async () => {
    // 1. Drain bucket
    await tokenBucket.consume('refill_test', 5, 5, 5); // Empty it
    
    // 2. Wait 1 second (should refill 5 tokens)
    await new Promise(r => setTimeout(r, 1100));

    // 3. Try again
    const result = await tokenBucket.consume('refill_test', 5, 5, 1);
    expect(result.allowed).toBe(true);
  });
});
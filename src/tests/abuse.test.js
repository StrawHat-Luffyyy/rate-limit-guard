import { jest } from '@jest/globals';
import redisClient, { closeRedis } from '../config/redis.js';
import abuseDetector from '../abuse/detector.js';

jest.setTimeout(10000);

describe('Abuse Detection System', () => {
  const testIP = '192.168.1.100';
  const threshold = 3; // Block after 3 strikes
  const violationTTL = 60;
  const blockDuration = 10; // Block for 10 seconds

  beforeAll(async () => {
    if (redisClient.status !== 'ready') {
      await new Promise((resolve) => redisClient.once('ready', resolve));
    }
    await redisClient.del(`abuse:violations:${testIP}`);
    await redisClient.del(`abuse:blocked:${testIP}`);
  });

  afterAll(async () => {
    await redisClient.del(`abuse:violations:${testIP}`);
    await redisClient.del(`abuse:blocked:${testIP}`);
    await closeRedis();
  });

  test('should increment violation count', async () => {
    const result = await abuseDetector.reportViolation(testIP, threshold, violationTTL, blockDuration);
    expect(result.blocked).toBe(false);
    expect(result.violationCount).toBe(1);
  });

  test('should trigger block on threshold', async () => {
    // 2nd Strike
    await abuseDetector.reportViolation(testIP, threshold, violationTTL, blockDuration);
    
    // 3rd Strike (Should Block)
    const result = await abuseDetector.reportViolation(testIP, threshold, violationTTL, blockDuration);
    
    expect(result.blocked).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test('checkBlock should return true for blocked user', async () => {
    const result = await abuseDetector.checkBlock(testIP);
    expect(result.blocked).toBe(true);
  });
});
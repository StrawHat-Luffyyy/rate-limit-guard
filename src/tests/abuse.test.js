// src/tests/abuse.test.js
import { jest } from '@jest/globals';
import redisClient, { closeRedis } from '../config/redis.js';
import abuseDetector from '../abuse/detector.js';

// Increase timeout to 30s just in case Docker is slow
jest.setTimeout(30000);

describe('Abuse Detection System (Enhanced)', () => {
  const testIP = '10.0.0.5';
  const vipIP = '10.0.0.99';

  beforeAll(async () => {
    // 1. If already ready, stop waiting
    if (redisClient.status === 'ready') {
      return;
    }

    // 2. If connecting, wait for it
    if (redisClient.status === 'connecting' || redisClient.status === 'reconnecting') {
        await new Promise((resolve, reject) => {
            redisClient.once('ready', resolve);
            redisClient.once('error', reject);
        });
        return;
    }

    // 3. If closed or end, force connect (though ioredis usually auto-connects)
    if (redisClient.status === 'end') {
        await redisClient.connect();
    }
    
    // 4. Final safety check: Ping Redis
    try {
        await redisClient.ping();
    } catch (e) {
        throw new Error(`Redis is not reachable: ${e.message}. Is Docker running?`);
    }
  });

  beforeEach(async () => {
    // Reset state before each test
    const keys = [
        `abuse:blocked:${testIP}`,
        `abuse:violations:${testIP}`,
        `abuse:blocked:${vipIP}`,
        `abuse:violations:${vipIP}`
    ];
    await redisClient.del(keys);
    await redisClient.srem('abuse:whitelist', vipIP);
  });

  afterAll(async () => {
    // Clean up connections
    await closeRedis();
  });

  test('should allow manual blocking', async () => {
    // Block for 60 seconds
    await abuseDetector.block(testIP, 60);
    
    // Check status
    const status = await abuseDetector.checkStatus(testIP);
    
    // Verify
    expect(status.status).toBe('blocked');
    expect(status.retryAfter).toBeGreaterThan(0);
  });

  test('should allow manual unblocking', async () => {
    // Block then Unblock
    await abuseDetector.block(testIP, 60);
    await abuseDetector.unblock(testIP);
    
    // Check status
    const status = await abuseDetector.checkStatus(testIP);
    expect(status.status).toBe('allowed');
  });

  test('should NEVER block whitelisted IPs', async () => {
    // 1. Add to whitelist
    await abuseDetector.whitelist(vipIP);

    // 2. Spam violations (10 attempts, limit is 5)
    for (let i = 0; i < 10; i++) {
      const result = await abuseDetector.reportViolation(vipIP, 5, 60, 60);
      expect(result.blocked).toBe(false);
    }

    // 3. Verify allowed
    const status = await abuseDetector.checkStatus(vipIP);
    expect(status.status).toBe('allowed');
    expect(status.reason).toBe('whitelist');
  });
});
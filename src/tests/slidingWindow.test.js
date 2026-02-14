// src/tests/slidingWindow.test.js
import { jest } from "@jest/globals";
import redisClient, { closeRedis } from "../config/redis.js";
import slidingWindow from "../ratelimit/slidingWindow.js";

jest.setTimeout(10000);

describe("Sliding Window Algorithm", () => {
  const testKey = "sw_test_user";
  const limit = 3;
  const windowMs = 1000; // 1 second

  beforeAll(async () => {
    if (redisClient.status !== "ready") {
      await new Promise((resolve) => redisClient.once("ready", resolve));
    }
    await redisClient.del(`rl:sw:${testKey}`);
  });

  afterAll(async () => {
    await redisClient.del(`rl:sw:${testKey}`);
    await closeRedis();
  });

  test("should allow requests within limit", async () => {
    // Make 3 requests (Limit is 3)
    const r1 = await slidingWindow.check(testKey, limit, windowMs);
    const r2 = await slidingWindow.check(testKey, limit, windowMs);
    const r3 = await slidingWindow.check(testKey, limit, windowMs);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  test("should block 4th request", async () => {
    const r4 = await slidingWindow.check(testKey, limit, windowMs);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  test("should expire old requests and allow new ones", async () => {
    // Wait for window to slide (1.1 seconds)
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const r5 = await slidingWindow.check(testKey, limit, windowMs);
    expect(r5.allowed).toBe(true);
    expect(r5.remaining).toBe(2);
  });
});

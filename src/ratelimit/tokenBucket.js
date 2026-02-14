import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import redisClient from "../config/redis.js";
import logger from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TokenBucket {
  constructor() {
    // Load Lua script
    const scriptPath = path.join(__dirname, "../scripts/tokenBucket.lua");
    this.script = fs.readFileSync(scriptPath, "utf-8");

    // Register command with Redis
    // 'tokenBucket' becomes a method on the redis client
    redisClient.defineCommand("tokenBucket", {
      numberOfKeys: 2,
      lua: this.script,
    });
  }
  /**
   * Attempt to consume tokens
   * @param {string} key - Unique identifier (e.g., ip:127.0.0.1)
   * @param {number} capacity - Max burst size
   * @param {number} refillRate - Tokens per second
   * @param {number} cost - How many tokens this request costs (default 1)
   */
  async consume(key, capacity, refillRate, cost = 1) {
    const tokenKey = `rl:tb:tokens:${key}`;
    const timeKey = `rl:tb:timestamp:${key}`;
    const now = Date.now();
    try {
      const result = await redisClient.tokenBucket(
        tokenKey,
        timeKey,
        capacity,
        refillRate,
        now,
        cost,
      );
      const [allowed, remaining] = result;
      return {
        allowed: Boolean(allowed),
        remainingTokens: parseFloat(remaining),
        cost: cost,
      };
    } catch (error) {
      logger.error("Token Bucket Error", { error: error.message, key });
      // Fail Open Strategy: If Redis fails, allow the request
      return { allowed: true, remainingTokens: 1, failOpen: true };
    }
  }
}

export default new TokenBucket();

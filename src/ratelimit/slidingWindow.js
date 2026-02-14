import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import redisClient from "../config/redis.js";
import logger from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SlidingWindow {
  constructor() {
    const scriptPath = path.join(__dirname, "../scripts/slidingWindow.lua");
    try {
      this.script = fs.readFileSync(scriptPath, "utf-8");
      redisClient.defineCommand("slidingWindow", {
        numberOfKeys: 1,
        lua: this.script,
      });
    } catch (err) {
      logger.error("Failed to load Sliding Window Lua script", {
        error: err.message,
      });
    }
  }
  /**
   * Check Rate Limit
   * @param {string} key - Unique Identifier
   * @param {number} limit - Max requests
   * @param {number} windowMs - Window size in milliseconds
   */

  async check(key, limit, windowMs) {
    const redisKey = `rl:sw:${key}`;
    const now = Date.now();
    const reqId = uuidv4();
    try {
      const result = await redisClient.slidingWindow(
        redisKey,
        windowMs,
        limit,
        now,
        reqId,
      );
      if (!Array.isArray(result)) {
        throw new Error("Invalid response from Lua script");
      }
      const [status, data] = result;
      if (status == 1) {
        return {
          allowed: true,
          remaining: data,
        };
      } else {
        return {
          allowed: false,
          retryAfterMs: data,
        };
      }
    } catch {
      logger.error("Sliding Window Error", { key, error: error.message });
      return { allowed: true, failOpen: true };
    }
  }
}

export default new SlidingWindow();

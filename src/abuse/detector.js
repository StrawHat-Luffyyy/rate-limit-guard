import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../config/logger.js";
import redisClient from "../config/redis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AbuseDetector {
  constructor() {
    const scriptPath = path.join(__dirname, "../scripts/abuseCheck.lua");
    try {
      this.script = fs.readFileSync(scriptPath, "utf8");
      redisClient.defineCommand("recordAbuse", {
        numberOfKeys: 2,
        lua: this.script,
      });
    } catch (err) {
      logger.error("Failed to load Abuse Lua script", { error: err.message });
    }
  }
  /**
   * Report a violation (e.g., user hit a 429)
   * @param {string} ip - User IP
   * @param {number} threshold - Max violations before block
   * @param {number} violationTTL - How long to remember violations (seconds)
   * @param {number} blockDuration - How long to block if threshold met (seconds)
   */
  async reportViolation(
    ip,
    threshold = 5,
    violationTTL = 3600,
    blockDuration = 86400,
  ) {
    const violationKey = `abuse:violations:${ip}`;
    const blockKey = `abuse:blocked:${ip}`;
    try {
      const result = await redisClient.recordAbuse(
        violationKey,
        blockKey,
        violationTTL,
        threshold,
        blockDuration,
      );
      const [isBlocked, data] = result;
      if (isBlocked == 1) {
        logger.warn(`IP Blocked due to abuse: ${ip}`, { ttl: data });
        return { blocked: true, retryAfter: data };
      }
      return { blocked: false, violationCount: data };
    } catch (error) {
      logger.error("Abuse Detector Error", { error: error.message });
      // Fail open: Don't block if Redis is down
      return { blocked: false, error: true };
    }
  }
  /**
   * Check if an IP is currently blocked
   */
  async checkBlock(ip) {
    const blockKey = `abuse:blocked:${ip}`;
    const ttl = await redisClient.ttl(blockKey);
    if (ttl > 0) {
      return { blocked: true, retryAfter: ttl };
    }
    return { blocked: false };
  }
}
export default new AbuseDetector();

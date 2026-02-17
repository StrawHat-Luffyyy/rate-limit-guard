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
   * Check if an IP is allowed (checks whitelist and blocklist)
   */
  async checkStatus(ip) {
    const result = await redisClient.sismember("abuse:whitelist", ip);

    if (result == 1) {
      return { status: "allowed", reason: "whitelist" };
    }

    // Check Blocklist
    const blockKey = `abuse:blocked:${ip}`;
    const ttl = await redisClient.ttl(blockKey);

    if (ttl > 0) {
      return { status: "blocked", retryAfter: ttl };
    }

    return { status: "allowed" };
  }

  /**
   * Report a violation (Auto-blocking logic)
   */
  async reportViolation(
    ip,
    threshold = 5,
    violationTTL = 3600,
    blockDuration = 86400,
  ) {
    // FIX: Direct whitelist check as the primary guard — avoids any ambiguity
    // from checkStatus's return shape and stops the Lua script from ever running
    // for whitelisted IPs.
    const isWhitelisted = await redisClient.sismember("abuse:whitelist", ip);
    if (isWhitelisted == 1) {
      return { blocked: false };
    }

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
        logger.warn(`IP Auto-Blocked: ${ip}`, { ttl: data });
        return { blocked: true, retryAfter: data };
      }
      return { blocked: false, violationCount: data };
    } catch (error) {
      logger.error("Abuse Detector Error", { error: error.message });
      return { blocked: false, error: true };
    }
  }

  /**
   * Manually block an IP
   */
  async block(ip, duration = 86400, reason = "manual_admin_action") {
    const blockKey = `abuse:blocked:${ip}`;
    await redisClient.set(blockKey, reason, "EX", duration);
    logger.info(`Manually blocked IP: ${ip} for ${duration}s`);
  }

  /**
   * Manually unblock an IP
   */
  async unblock(ip) {
    const blockKey = `abuse:blocked:${ip}`;
    const violationKey = `abuse:violations:${ip}`;
    await redisClient.del(blockKey, violationKey);
    logger.info(`Manually unblocked IP: ${ip}`);
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

  /**
   * Add IP to Whitelist
   */
  async whitelist(ip) {
    await redisClient.sadd("abuse:whitelist", ip);
    await this.unblock(ip);
    logger.info(`Whitelisted IP: ${ip}`);
  }

  /**
   * Remove IP from Whitelist
   */
  async unwhitelist(ip) {
    await redisClient.srem("abuse:whitelist", ip);
    logger.info(`Removed IP from whitelist: ${ip}`);
  }
}

export default new AbuseDetector();

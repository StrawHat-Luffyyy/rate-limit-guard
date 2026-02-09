import Redis from "ioredis";
import { config } from "./env.js";

const logger = console; // Replace with your logging library if needed

let redisClient;

/**
 * Define connection options including exponential backoff
 */

const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  keyPrefix: config.redis.keyPrefix,
  enableOfflineQueue: false, // Fail fast if Redis is down (important for rate limiting)

  // Exponential backoff strategy
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000); // Exponential backoff with a max delay of 2 seconds
    logger.warn(`Redis retry attempt #${times}. Reconnecting in ${delay}ms...`);
    return delay;
  },

  // Reconnect on error strategy
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      // Only reconnect when the error starts with "READONLY"
      return true;
    }
  },
};

/**
 * Initialize Redis Client based on mode
 */

if (config.redis.mode === "cluster") {
  // Parse nodes for cluster: ["host:port", ...] -> [{host, port}, ...]
  const clusterNodes = config.redis.nodes.map((node) => {
    const [host, port] = node.split(":");
    return { host, port: parseInt(port, 10) };
  });
  logger.info(
    `Initializing Redis Cluster with ${clusterNodes.length} nodes...`,
  );
  redisClient = new Redis.Cluster(clusterNodes, {
    redisOptions: redisOptions,
    scaleReads: "slave", // Read from replicas if available
  });
} else {
  logger.info(
    `Initializing Redis Standalone at ${config.redis.host}:${config.redis.port}...`,
  );
  redisClient = new Redis(redisOptions);
}

// --- Event Listeners ---
redisClient.on("connect", () =>
  logger.info("Connected to Redis successfully."),
);
redisClient.on("error", (err) => logger.error("Redis connection error:", err));
redisClient.on("ready", () => logger.info("Redis client is ready to use."));
redisClient.on("reconnecting", (delay) =>
  logger.warn(`Redis reconnecting... Next attempt in ${delay}ms`),  
)
redisClient.on("end", () => logger.warn("Redis connection closed."));

// --- Helper Methods ---

/**
 * Health check for Readiness Probes (K8s)
 */

export const healthCheck = async () => {
  try {
    
    const start = Date.now();
    const result = await redisClient.ping();
    const duration = Date.now() - start;
    if (result === "PONG") {
      return { status: "healthy", latency: `${duration}ms` };
    }
    throw new Error("Redis did not respond with PONG");
  } catch (error) {
    logger.error("Redis health check failed:", error);
    return { status: "unhealthy", error: error.message };
  }
};

/**
 * Graceful Shutdown
 */
export const closeRedis = async () => {
  await redisClient.quit();
};

// Export the singleton instance
export default redisClient;

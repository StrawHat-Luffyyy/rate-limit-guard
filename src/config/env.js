import dotenv from "dotenv";
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3000,
  redis: {
    mode: process.env.REDIS_MODE || "standalone", // 'standalone' or 'cluster'
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    nodes: process.env.REDIS_NODES ? process.env.REDIS_NODES.split(",") : [],
    keyPrefix: "rl:", // Namespacing for safety
  },
};

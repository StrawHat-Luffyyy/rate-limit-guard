import winston from "winston";
import "winston-daily-rotate-file";
import { config } from "../config/env.js";

const { combine, json, timestamp, printf, colorize, align } = winston.format;

// Custom format for development (human readable)
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  align(),
  printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`),
);

// JSON format for production (machine readable)
const prodFormat = combine(timestamp(), json());

const logger = winston.createLogger({
  level: config.env === "development" ? "debug" : "info",
  format: config.env === "development" ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
});

// Add file rotation ONLY in production/staging to avoid cluttering local dev
if (config.env !== "development") {
  logger.add(
    new winston.transports.DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  );
  logger.add(
    new winston.transports.DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  );
}

// Create a stream for Morgan (if you choose to use it later for HTTP logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export default logger;

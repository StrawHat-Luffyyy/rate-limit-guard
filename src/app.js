import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import { v4 as uuidv4 } from "uuid";
import logger from "./config/logger.js";
import { AppError, errorHandler } from "./middleware/errorHandler.js";

const app = express();
dotenv.config();

// Security Middleware
app.use(helmet());
app.use(express.json());

// Request ID & Basic Logging Middleware
app.use((req, res, next) => {
  req.id = uuidv4(); // Generate unique ID for tracing
  logger.info(`Incoming Request: ${req.method} ${req.url}`, {
    requestId: req.id,
    ip: req.ip,
  });
  next();
});

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date() });
});

// Global Error Handler
app.use(errorHandler);
export default app;

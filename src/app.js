import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import { v4, uuidv4 } from "uuid";
import { logger } from "./config/logger.js";

const app = express();
dotenv.config();

// Security Middleware
app.use(helmet());
app.use(express.json());

// Request ID & Basic Logging Middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  logger.info(`Incoming request`, {
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
  });
  next();
});

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date() });
});

// Global error Handler
app.use((err, req, res, next) => {
  logger.error("Unhandled Error", { requestId: req.id, error: err.message });
  res.status(500).json({ error: "Internal Server Error", requestId: req.id });
});

export default app;

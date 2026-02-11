import  logger  from "../config/logger.js";

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error ";
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // 1. Log the error with Context
  logger.error(err.message, {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    stack: err.stack,
  });

  // 2. Send Response
  if (process.env.NODE_ENV === "development") {
    // Dev: Send detailed error
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // Prod: Send generic message for 500s, specific for 400s
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      // Programming or other unknown error: don't leak details
      res.status(500).json({
        status: "error",
        message: "Something went wrong!",
      });
    }
  }
};

export { AppError, errorHandler };

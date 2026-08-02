import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  logger.error({ err: err.message, stack: err.stack, path: req.path }, "Unhandled Application Exception");

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

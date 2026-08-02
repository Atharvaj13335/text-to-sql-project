import { logger } from "./logger.js";
import { SqlValidationError } from "./validateSql.js";

export function errorHandler(err, req, res, next) {
  logger.error({ err: err.message || err, url: req.originalUrl, method: req.method }, "Unhandled Express Application Error");

  if (err instanceof SqlValidationError) {
    return res.status(422).json({
      success: false,
      error: `SQL Safety Error: ${err.message}`,
    });
  }

  const status = err.status || 500;
  const message = err.message || "An unexpected internal server error occurred.";

  res.status(status).json({
    success: false,
    error: message,
  });
}

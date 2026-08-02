import jwt from "jsonwebtoken";
import { logger } from "../utils/logger.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.fatal("FATAL ERROR: JWT_SECRET environment variable is not defined. Refusing to start server.");
  process.exit(1);
}

export function generateToken(userPayload) {
  return jwt.sign(userPayload, JWT_SECRET, { expiresIn: "24h" });
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn({ ip: req.ip, path: req.path }, "Unauthorized access attempt: Missing or invalid Authorization header");
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please provide a valid Bearer token in the Authorization header.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn({ ip: req.ip, path: req.path, err: err.message }, "Unauthorized access attempt: Invalid or expired JWT token");
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token. Please sign in again.",
    });
  }
}

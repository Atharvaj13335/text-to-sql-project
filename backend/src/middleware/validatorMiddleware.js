import { z } from "zod";
import { logger } from "../utils/logger.js";

export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  role: z.enum(["admin", "analyst", "viewer"]).optional(),
  region: z.string().optional(),
});

export const signinSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const askSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  chatId: z.string().optional(),
});

export const executeSqlSchema = z.object({
  sql: z.string().min(1, "SQL statement is required"),
});

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errorDetails = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      logger.warn({ ip: req.ip, path: req.path, errors: errorDetails }, "Request payload validation failed");
      return res.status(400).json({
        success: false,
        error: `Validation Error: ${errorDetails}`,
      });
    }
    req.body = result.data;
    next();
  };
}

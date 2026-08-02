import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Valid email address is required"),
  name: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  mobile: z.string().optional(),
  role: z.enum(["admin", "analyst", "viewer"]).optional(),
  region: z.string().optional(),
});

export const signinSchema = z.object({
  email: z.string().email("Valid email address is required"),
  password: z.string().min(1, "Password is required"),
});

export const askSchema = z.object({
  question: z.string().min(1, "Question is required").max(500, "Question max length is 500 characters"),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
});

export const executeSqlSchema = z.object({
  sql: z.string().min(1, "SQL string is required").max(2000, "SQL max length is 2000 characters"),
});

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errorMsg = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return res.status(400).json({ success: false, error: `Validation Error: ${errorMsg}` });
    }
    req.body = result.data;
    next();
  };
}

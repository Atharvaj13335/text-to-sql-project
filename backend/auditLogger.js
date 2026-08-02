import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "audit.jsonl");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Mongoose AuditLog Schema & Model for persistent MongoDB storage
const auditLogSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    ip: { type: String, default: "127.0.0.1" },
    queryType: { type: String, enum: ["TEXT_TO_SQL", "CONVERSATIONAL", "DIRECT_EXECUTE"], required: true },
    question: { type: String, default: null },
    sql: { type: String, default: null },
    executionTimeMs: { type: Number, default: 0 },
    status: { type: String, enum: ["SUCCESS", "FAILURE"], default: "SUCCESS" },
    rowCount: { type: Number, default: 0 },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

/**
 * Log a structured query audit entry to MongoDB and persistent JSONL file.
 */
export async function logAuditEntry(entry) {
  const auditData = {
    timestamp: new Date().toISOString(),
    userEmail: entry.userEmail || "anonymous",
    ip: entry.ip || "127.0.0.1",
    queryType: entry.queryType || "TEXT_TO_SQL",
    question: entry.question || null,
    sql: entry.sql || null,
    executionTimeMs: entry.executionTimeMs || 0,
    status: entry.status || "SUCCESS",
    rowCount: entry.rowCount !== undefined ? entry.rowCount : 0,
    error: entry.error || null,
  };

  const line = JSON.stringify(auditData) + "\n";

  // 1. Write to JSONL file
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) {
      console.error("Failed to write to audit log file:", err.message);
    }
  });

  // 2. Persist to MongoDB collection if connection is active
  try {
    if (mongoose.connection.readyState === 1) {
      await AuditLog.create(auditData);
    }
  } catch (dbErr) {
    console.error("Failed to persist audit log to MongoDB:", dbErr.message);
  }

  // 3. Print structured log line to stdout
  console.log(`[AUDIT LOG] ${auditData.timestamp} | User: ${auditData.userEmail} | Type: ${auditData.queryType} | Rows: ${auditData.rowCount} | Time: ${auditData.executionTimeMs}ms | Status: ${auditData.status}`);
}

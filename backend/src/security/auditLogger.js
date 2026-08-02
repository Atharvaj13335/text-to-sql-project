import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const AUDIT_DIR = path.resolve(process.cwd(), "logs");
const AUDIT_FILE = path.join(AUDIT_DIR, "audit.jsonl");

if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    userEmail: { type: String, required: true, index: true },
    ip: { type: String, default: "unknown" },
    queryType: { type: String, default: "TEXT_TO_SQL" },
    question: { type: String },
    sql: { type: String },
    executionTimeMs: { type: Number, default: 0 },
    status: { type: String, enum: ["SUCCESS", "FAILURE", "BLOCKED"], default: "SUCCESS" },
    rowCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export async function logAuditEntry(entry) {
  const auditRecord = {
    timestamp: new Date().toISOString(),
    userEmail: entry.userEmail || "anonymous",
    ip: entry.ip || "unknown",
    queryType: entry.queryType || "TEXT_TO_SQL",
    question: entry.question || "",
    sql: entry.sql || "",
    executionTimeMs: entry.executionTimeMs || 0,
    status: entry.status || "SUCCESS",
    rowCount: entry.rowCount || 0,
    error: entry.error || null,
  };

  try {
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(auditRecord) + "\n", "utf8");
  } catch (err) {
    logger.error({ err: err.message }, "Failed to write audit log entry to file.");
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const doc = new AuditLog({
        ...auditRecord,
        timestamp: new Date(auditRecord.timestamp),
      });
      await doc.save();
    } catch (err) {
      logger.error({ err: err.message }, "Failed to save audit log to MongoDB.");
    }
  }

  logger.info(
    {
      userEmail: auditRecord.userEmail,
      status: auditRecord.status,
      executionTimeMs: auditRecord.executionTimeMs,
    },
    `AUDIT EVENT: ${auditRecord.queryType}`
  );
}

export async function getAuditLogs(limit = 100) {
  if (mongoose.connection.readyState === 1) {
    return await AuditLog.find({}).sort({ timestamp: -1 }).limit(limit).lean();
  }
  return [];
}

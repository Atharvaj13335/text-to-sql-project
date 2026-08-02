import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "audit.jsonl");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Log a structured query audit entry.
 */
export function logAuditEntry(entry) {
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

  // Write to log file asynchronously
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) {
      console.error("Failed to write to audit log file:", err.message);
    }
  });

  // Also print structured log line to stdout
  console.log(`[AUDIT LOG] ${auditData.timestamp} | User: ${auditData.userEmail} | Type: ${auditData.queryType} | Rows: ${auditData.rowCount} | Time: ${auditData.executionTimeMs}ms | Status: ${auditData.status}`);
}

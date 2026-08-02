import mssql from "mssql";
import { logger } from "../utils/logger.js";

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "FinancialReporting",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};

let pool = null;

export async function getPool() {
  if (pool) return pool;
  try {
    pool = await mssql.connect(dbConfig);
    logger.info("Connected to Microsoft SQL Server successfully.");
    return pool;
  } catch (err) {
    logger.error({ err: err.message }, "SQL Server Connection Failed. Will use mock evaluation fallback.");
    throw err;
  }
}

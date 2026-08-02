import { logger } from "./logger.js";

const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "OPENROUTER_API_KEY",
  "MONGO_URI",
  "DB_SERVER",
  "DB_NAME",
];

export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logger.error({ missing }, "❌ FATAL: Missing required environment variables on startup.");
    console.error(`❌ FATAL: The following required environment variables are missing:\n   ${missing.join(", ")}\n`);
    console.error("   Please configure them in your environment or backend/.env file before launching.");
    process.exit(1);
  }

  logger.info("Environment variable validation passed.");
}

import { logger } from "../utils/logger.js";

const REQUIRED_ENV_VARS = ["JWT_SECRET", "OPENROUTER_API_KEY", "MONGO_URI"];

export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logger.fatal(
      { missingVars: missing },
      "CRITICAL CONFIGURATION ERROR: Missing required environment variables. The server will not start without secure credentials."
    );
    process.exit(1);
  }

  logger.info("Environment variable validation passed.");
}

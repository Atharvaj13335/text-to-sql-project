import jwt from "jsonwebtoken";
import crypto from "crypto";

// Ensure JWT_SECRET is strong; generate per-boot random fallback if env var is absent
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  console.warn("⚠️  SECURITY WARNING: JWT_SECRET environment variable is not set. Generating a random secret per server instance.");
  return crypto.randomBytes(32).toString("hex");
})();

/**
 * Generate a JWT token for a user.
 */
export function generateToken(user) {
  return jwt.sign(
    { email: user.email, name: user.name, provider: user.provider },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Express middleware — strictly validates Bearer token.
 * Attaches decoded user payload to `req.user`.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication required. Please sign in with a valid token." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token. Please sign in again." });
  }
}

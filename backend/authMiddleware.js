import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_dev_secret_key";

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
 * Express middleware — validates Bearer token.
 * Attaches decoded user payload to `req.user`.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // Also allow legacy x-user-email header for backward compatibility
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const legacyEmail = req.headers["x-user-email"];
    if (legacyEmail) {
      req.user = { email: legacyEmail.trim().toLowerCase() };
      return next();
    }
    return res.status(401).json({ success: false, error: "Authentication required. Please sign in." });
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

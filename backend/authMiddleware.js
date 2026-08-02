import jwt from "jsonwebtoken";

// JWT_SECRET is REQUIRED — refuse to boot without it
if (!process.env.JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is not set. Server will not start.");
  console.error("   Set it in backend/.env:  JWT_SECRET=your-strong-random-secret-here");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

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

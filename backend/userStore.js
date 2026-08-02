import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    password: { type: String, default: "" },
    mobile: { type: String, default: "" },
    role: { type: String, enum: ["admin", "analyst", "viewer"], default: "analyst" },
    region: { type: String, default: "" },
    provider: { type: String, default: "password" },
    avatar: { type: String, default: "" },
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeUser(user) {
  return {
    email: user.email,
    name: user.name,
    mobile: user.mobile || "",
    role: user.role || "analyst",
    region: user.region || "",
    provider: user.provider,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

// ---------------------------------------------------------------------------
// Sign Up — rejects if account already exists
// ---------------------------------------------------------------------------
export async function registerUser({ email, name, password, mobile, provider, avatar }) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw { status: 400, message: "A valid email address is required." };
  }

  if (password && password.length < 6) {
    throw { status: 400, message: "Password must be at least 6 characters long." };
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw { status: 409, message: "Account already registered with this email. Please sign in instead." };
  }

  const hashedPassword = password ? await bcrypt.hash(password, 10) : "";

  const user = new User({
    email: email.toLowerCase(),
    name: name || email.split("@")[0],
    password: hashedPassword,
    mobile: mobile || "",
    provider: provider || "password",
    avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
    lastLogin: new Date(),
  });
  await user.save();
  return sanitizeUser(user);
}

// ---------------------------------------------------------------------------
// Sign In — rejects if account doesn't exist
// ---------------------------------------------------------------------------
export async function loginUser(email, password) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw { status: 400, message: "A valid email address is required." };
  }
  if (!password) {
    throw { status: 400, message: "Password is required." };
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw { status: 404, message: "No account found with this email. Please sign up first." };
  }

  if (!user.password) {
    throw { status: 401, message: "This account was registered via Google/OTP. Please use that method to sign in, or set a password via Sign Up." };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw { status: 401, message: "Incorrect password. Please try again." };
  }

  user.lastLogin = new Date();
  await user.save();
  return sanitizeUser(user);
}

// ---------------------------------------------------------------------------
// Google / OTP Sign In — find or create (used for social/OTP login)
// ---------------------------------------------------------------------------
export async function findOrCreateUser({ email, name, mobile, provider, avatar }) {
  if (!email) throw { status: 400, message: "Email is required." };

  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    user.lastLogin = new Date();
    if (name && !user.name) user.name = name;
    if (mobile && !user.mobile) user.mobile = mobile;
    if (avatar && !user.avatar) user.avatar = avatar;
    if (provider) user.provider = provider;
    await user.save();
  } else {
    user = new User({
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      mobile: mobile || "",
      provider: provider || "google",
      avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      lastLogin: new Date(),
    });
    await user.save();
  }

  return sanitizeUser(user);
}

// ---------------------------------------------------------------------------
// Get user profile by email
// ---------------------------------------------------------------------------
export async function getUserByEmail(email) {
  if (!email) return null;
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) return null;
  return sanitizeUser(user);
}

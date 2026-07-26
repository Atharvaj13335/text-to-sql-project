import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    password: { type: String, default: "" }, // plain text for demo; use bcrypt in production
    mobile: { type: String, default: "" },
    provider: { type: String, default: "password" }, // 'password' | 'email-otp' | 'mobile-otp' | 'google'
    avatar: { type: String, default: "" },
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// ---------------------------------------------------------------------------
// User CRUD Helpers
// ---------------------------------------------------------------------------

/** Find or create a user by email. Returns user object. */
export async function findOrCreateUser({ email, name, password, mobile, provider, avatar }) {
  if (!email) throw new Error("Email is required.");

  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    // Update last login & any new fields
    user.lastLogin = new Date();
    if (name && !user.name) user.name = name;
    if (mobile && !user.mobile) user.mobile = mobile;
    if (avatar && !user.avatar) user.avatar = avatar;
    if (provider) user.provider = provider;
    await user.save();
  } else {
    // Create new user
    user = new User({
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      password: password || "",
      mobile: mobile || "",
      provider: provider || "password",
      avatar: avatar || "",
      lastLogin: new Date(),
    });
    await user.save();
  }

  return {
    email: user.email,
    name: user.name,
    mobile: user.mobile,
    provider: user.provider,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

/** Validate password login — returns user or null. */
export async function validatePasswordLogin(email, password) {
  if (!email || !password) return null;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Auto-register new user with password
    const newUser = new User({
      email: email.toLowerCase(),
      name: email.split("@")[0],
      password,
      provider: "password",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      lastLogin: new Date(),
    });
    await newUser.save();
    return {
      email: newUser.email,
      name: newUser.name,
      provider: newUser.provider,
      avatar: newUser.avatar,
    };
  }

  // If user exists but has no password set yet (registered via OTP/Google), set it now
  if (!user.password) {
    user.password = password;
    user.lastLogin = new Date();
    await user.save();
    return { email: user.email, name: user.name, provider: user.provider, avatar: user.avatar };
  }

  // Validate password
  if (user.password !== password) return null;

  user.lastLogin = new Date();
  await user.save();
  return { email: user.email, name: user.name, provider: user.provider, avatar: user.avatar };
}

/** Get user profile by email. */
export async function getUserByEmail(email) {
  if (!email) return null;
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) return null;
  return {
    email: user.email,
    name: user.name,
    mobile: user.mobile,
    provider: user.provider,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}
